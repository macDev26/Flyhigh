const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const Stripe = require('stripe');
const { createAuth } = require('./auth');

// Exercise the exact Vercel entry point without opening the local app's port or
// reading its env.txt. Only this generated database is created and removed.
process.env.VERCEL = '1';
process.env.MONGO_URI = process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017';
process.env.MONGO_DB_NAME = `Flyhigh_Deployment_Test_${randomBytes(8).toString('hex')}`;
process.env.FRONTEND_ORIGINS = 'https://airline-manager.vercel.app';
process.env.STRIPE_SECRET_KEY = 'sk_test_deployment_test_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_deployment_test_secret';
const backend = require('./server');
let server;
let origin;
let db;

before(async () => {
  const { default: handler } = await import('../api/index.js');
  server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  await backend.ready();
  db = backend.client.db(process.env.MONGO_DB_NAME);
});
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (db && /^Flyhigh_Deployment_Test_[a-f0-9]{16}$/.test(db.databaseName)) await db.dropDatabase();
  await backend.client.close();
});

test('hosted entry serves airports and rolling Flyhigh departures as JSON', async () => {
  const health = await fetch(`${origin}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).database, 'connected');
  const airports = await fetch(`${origin}/api/airports`).then(r => r.json());
  assert.deepEqual(airports.map(row => row.code).sort(), ['BOM', 'CCU', 'DEL', 'MAA']);
  const [routes, schedules] = await Promise.all(['/api/flights', '/api/flightinfo'].map(route => fetch(origin + route).then(r => r.json())));
  assert.equal(routes.length, 12);
  assert.equal(schedules.length, 168);
  assert.ok(schedules.every(row => row.operator === 'flyhigh'));
  const indexes = await db.collection('Sessions').indexes();
  assert.ok(indexes.some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
});

test('hosted login survives an instance change and logout revokes it everywhere', async () => {
  await db.collection('Users').insertOne({ email: 'deployment@example.com', password: 'synthetic-test-password', firstName: 'Deployment' });
  const response = await fetch(`${origin}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: process.env.FRONTEND_ORIGINS }, body: JSON.stringify({ email: 'deployment@example.com', password: 'synthetic-test-password' }) });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Lax; Secure/);
  const req = { headers: { cookie } };
  const otherInstance = createAuth({ users: db.collection('Users'), sessionCollection: db.collection('Sessions'), production: true });
  assert.equal((await otherInstance.getSession(req)).user.email, 'deployment@example.com');
  const stored = await db.collection('Sessions').findOne();
  assert.ok(!cookie.includes(stored._id), 'The database stores a digest instead of the cookie credential');
  const bookings = await fetch(`${origin}/bookings`, { headers: { cookie } });
  assert.equal(bookings.status, 200);
  assert.deepEqual(await bookings.json(), []);
  const denied = await fetch(`${origin}/api/users`, { headers: { cookie } });
  assert.equal(denied.status, 403);
  const logout = await fetch(`${origin}/api/auth/logout`, { method: 'POST', headers: { cookie, Origin: process.env.FRONTEND_ORIGINS } });
  assert.equal(logout.status, 200);
  assert.equal(await otherInstance.getSession(req), null);
});

test('hosted session expiry and changed admin allowlists are enforced across instances', async () => {
  const collection = db.collection('Sessions');
  const first = createAuth({ users: db.collection('Users'), sessionCollection: collection, adminEmails: 'admin@gmail.com', now: () => 0 });
  const res = { setHeader(name, value) { this.cookie = value; } };
  await first.startSession({ headers: {} }, res, { email: 'admin@gmail.com' }, 'admin');
  const req = { headers: { cookie: res.cookie } };
  const second = createAuth({ users: db.collection('Users'), sessionCollection: collection, adminEmails: '', now: () => 0 });
  assert.equal(await second.getSession(req), null);
  const expired = createAuth({ users: db.collection('Users'), sessionCollection: collection, adminEmails: 'admin@gmail.com', now: () => 8 * 60 * 60 * 1000 });
  assert.equal(await expired.getSession(req), null);
});

test('Vercel handler preserves signed raw webhook bodies and rejects forged signatures', async () => {
  const body = JSON.stringify({ id: 'evt_test_deployment', type: 'test.ping', livemode: false, data: { object: {} } });
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: body, secret: process.env.STRIPE_WEBHOOK_SECRET });
  const send = value => fetch(`${origin}/api/stripe/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': value }, body });
  assert.equal((await send(signature)).status, 200);
  assert.equal((await send('invalid')).status, 400);
});

test('hosted startup without MongoDB settings returns a clear 503 instead of a missing route', () => {
  const env = { ...process.env };
  delete env.MONGO_URI;
  const script = `import('../api/index.js').then(async ({ default: handler }) => {
    const res = { setHeader(){}, end(body){ console.log(JSON.stringify({ status: this.statusCode, body: JSON.parse(body) })); } };
    await handler({}, res);
  });`;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: path.resolve(__dirname), env, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout.trim());
  assert.equal(response.status, 503);
  assert.match(response.body.message, /database is unavailable/);
});
