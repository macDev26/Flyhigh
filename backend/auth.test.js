const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAuth, publicUser } = require('./auth');

const identity = { sub: 'google-123', email: 'admin@gmail.com', email_verified: true, given_name: 'Admin', family_name: 'Tester' };
function response() {
  return { code: 200, headers: {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader(name, value) { this.headers[name] = value; } };
}
function setup(options = {}) {
  const records = [];
  const users = {
    async findOne(query) { return records.find(user => query.googleSub ? user.googleSub === query.googleSub : new RegExp(query.email.$regex, 'i').test(user.email)) || null; },
    async insertOne(user) { user._id = records.length + 1; records.push(user); },
    async updateOne(query, update) { const user = records.find(row => query._id ? row._id === query._id : row.email === query.email); if (user) Object.assign(user, update.$set); },
  };
  const auth = createAuth({ users, clientId: 'test.apps.googleusercontent.com', adminEmails: 'admin@gmail.com', verifyToken: async () => identity, ...options });
  return { auth, records };
}
async function login(auth, role = 'user') {
  const req = { body: { credential: 'google-signed-token', role }, headers: {} };
  const res = response(); await auth.googleLogin(req, res);
  return res;
}
test('Google user signup creates a profile and an opaque HttpOnly session', async () => {
  const { auth, records } = setup(); const res = await login(auth);
  assert.equal(res.code, 200); assert.equal(res.body.user.role, 'user'); assert.equal(records.length, 1);
  assert.match(res.headers['Set-Cookie'], /HttpOnly; SameSite=Lax/);
  assert.equal(res.body.user.googleSub, undefined); assert.equal(res.body.user.password, undefined);
  assert.equal((await auth.getSession({ headers: { cookie: res.headers['Set-Cookie'] } })).user.email, 'admin@gmail.com');
});
test('only the explicitly allowed Google email can obtain an admin session', async () => {
  const { auth } = setup(); const res = await login(auth, 'admin');
  assert.equal(res.body.user.role, 'admin');
  let reached = false; await auth.requireAdmin({ headers: { cookie: res.headers['Set-Cookie'] } }, response(), () => { reached = true; }); assert.equal(reached, true);
});
test('an unlisted Google account is denied before creating an account', async () => {
  const { auth, records } = setup({ verifyToken: async () => ({ ...identity, email: 'other@gmail.com' }) });
  const res = await login(auth, 'admin'); assert.equal(res.code, 403); assert.equal(records.length, 0); assert.equal(res.headers['Set-Cookie'], undefined);
});
test('user sessions cannot access admin endpoints even for an allowlisted email', async () => {
  const { auth } = setup(); const res = await login(auth, 'user'); const denied = response();
  await auth.requireAdmin({ headers: { cookie: res.headers['Set-Cookie'] }, body: { role: 'admin' } }, denied, () => assert.fail('Admin access granted'));
  assert.equal(denied.code, 403);
});
test('missing and forged session cookies are rejected', async () => {
  const { auth } = setup(); for (const cookie of ['', 'flyhigh_session=forged']) { const res = response(); await auth.requireAdmin({ headers: { cookie } }, res, () => assert.fail('Access granted')); assert.equal(res.code, 401); }
});
test('invalid or expired Google tokens never create sessions', async () => {
  const { auth, records } = setup({ verifyToken: async () => { throw new Error('Invalid signature or expiration'); } }); const res = await login(auth);
  assert.equal(res.code, 401); assert.equal(records.length, 0);
});
test('unverified email and non-Google-managed email are rejected', async () => {
  for (const payload of [{ ...identity, email_verified: false }, { ...identity, email: 'admin@example.com' }]) {
    const { auth, records } = setup({ verifyToken: async () => payload }); const res = await login(auth); assert.ok([401, 403].includes(res.code)); assert.equal(records.length, 0);
  }
});
test('returning Google users and existing Gmail password accounts reuse one account', async () => {
  const { auth, records } = setup(); records.push({ _id: 1, email: identity.email, password: 'legacy-secret', firstName: 'Existing', mobileNumber: '123' });
  const first = await login(auth); await login(auth);
  assert.equal(records.length, 1); assert.equal(first.body.user.firstName, 'Existing'); assert.equal(records[0].googleSub, identity.sub); assert.equal(first.body.user.password, undefined);
});
test('conflicting Google account links are rejected', async () => {
  const { auth, records } = setup(); records.push({ _id: 1, email: identity.email, googleSub: 'another-subject' });
  assert.equal((await login(auth)).code, 409);
});
test('sessions expire and logout immediately revokes a cookie', async () => {
  let time = 0; const { auth } = setup({ now: () => time }); let res = await login(auth); const req = { headers: { cookie: res.headers['Set-Cookie'] } };
  time = 8 * 60 * 60 * 1000; assert.equal(await auth.getSession(req), null);
  res = await login(auth); req.headers.cookie = res.headers['Set-Cookie']; const out = response(); await auth.logout(req, out);
  assert.equal(await auth.getSession(req), null); assert.match(out.headers['Set-Cookie'], /Max-Age=0/);
});
test('configuration and database failures produce recoverable errors', async () => {
  assert.equal((await login(setup({ clientId: '' }).auth)).code, 503);
  assert.equal((await login(setup({ users: { async findOne() { throw new Error('Database offline'); } } }).auth)).code, 503);
});
test('profile projection never exposes credentials or persisted admin roles', () => {
  assert.deepEqual(publicUser({ email: 'test@gmail.com', password: 'secret', googleSub: 'sub', role: 'admin' }).role, 'user');
  assert.equal(publicUser({ email: 'test@gmail.com', password: 'secret' }).password, undefined);
});
