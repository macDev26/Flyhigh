const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { MongoClient, ObjectId } = require('mongodb');
const Stripe = require('stripe');
const { createPaymentService, validatePassengers } = require('./payments');
const { ensureFlyhighNetwork, indiaDate } = require('./airline');

const user = { email: 'learner@example.com', role: 'user' };
const origin = 'http://localhost:5173';
const clock = () => Date.parse('2026-11-23T06:00:00Z');
const passenger = { title: 'Ms', firstName: 'Sample', lastName: 'Traveler', gender: 'Female', dob: '2000-01-01', mobile: '9000000000' };

async function fixture(t, seats = 3) {
  const client = new MongoClient(process.env.MONGO_TEST_URI || 'mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 4000 });
  await client.connect();
  const name = `Flyhigh_Payment_Test_${crypto.randomBytes(8).toString('hex')}`;
  const db = client.db(name);
  t.after(async () => { try { assert.ok(name.startsWith('Flyhigh_Payment_Test_')); await db.dropDatabase(); } finally { await client.close(); } });
  const scheduleId = new ObjectId();
  await db.collection('Flights').insertOne({ flightNumber: 'FH901', flightName: 'Flyhigh', operator: 'flyhigh', originAirport: 'DEL', destinationAirport: 'BOM' });
  await db.collection('Flight Info').insertOne({ _id: scheduleId, operator: 'flyhigh', flightNumber: 'FH901', departureTime: '2026-11-25T10:00', arrivalTime: '2026-11-25T12:00', seatsAvailable: { economy: seats, business: 2, first: -1 }, prices: { economy: 2500, business: 6000, first: 0 } });
  await db.createCollection('Bookings');
  const sessions = new Map();
  const checkoutRequests = [];
  const refunds = new Map();
  let failCreate = false;
  const stripe = {
    checkout: { sessions: {
      async create(params, options) {
        if (failCreate) throw new Error('Simulated Stripe outage');
        const existing = [...sessions.values()].find(row => row.idempotencyKey === options.idempotencyKey);
        if (existing) return structuredClone(existing);
        checkoutRequests.push(params);
        const session = { id: `cs_test_${sessions.size + 1}`, livemode: false, status: 'open', payment_status: 'unpaid', mode: 'payment', currency: 'inr', amount_total: params.line_items[0].price_data.unit_amount * params.line_items[0].quantity, client_reference_id: params.client_reference_id, metadata: params.metadata, url: 'https://checkout.stripe.com/test-session', idempotencyKey: options.idempotencyKey };
        sessions.set(session.id, session); return structuredClone(session);
      },
      async retrieve(id) { if (!sessions.has(id)) throw new Error('Unknown session'); return structuredClone(sessions.get(id)); },
      async expire(id) { const session = sessions.get(id); if (session.status !== 'open') throw new Error('Already complete'); session.status = 'expired'; return structuredClone(session); },
    } },
    refunds: { async create(params, options) { if (!refunds.has(options.idempotencyKey)) refunds.set(options.idempotencyKey, { id: `re_test_${refunds.size + 1}`, status: 'succeeded', ...params }); return refunds.get(options.idempotencyKey); } },
    webhooks: new Stripe('sk_test_unit_only').webhooks,
  };
  const service = createPaymentService({ db, stripe, testMode: true, allowedOrigins: [origin], webhookSecret: 'whsec_unit_only', now: clock });
  const body = { requestId: crypto.randomUUID(), data: { scheduleId: scheduleId.toHexString(), passengers: 1, seat: 'Economy', price: 1, flightName: 'Tampered airline' }, formData: [passenger] };
  const pay = id => { Object.assign(sessions.get(id), { status: 'complete', payment_status: 'paid', payment_intent: `pi_test_${id}` }); };
  const create = async (selection = body, account = user) => { const result = await service.createCheckout(selection, account, origin); return { ...result, sessionId: [...sessions.values()].find(row => row.metadata.orderId === result.orderId)?.id }; };
  const remaining = async () => (await db.collection('Flight Info').findOne({ _id: scheduleId })).seatsAvailable.economy;
  return { client, db, service, stripe, body, create, pay, sessions, refunds, checkoutRequests, remaining, scheduleId, setOutage(value) { failCreate = value; } };
}

test('passenger validation rejects missing passengers and impossible dates', () => {
  assert.throws(() => validatePassengers([], 1, clock()), /passengers/);
  assert.throws(() => validatePassengers([{ ...passenger, dob: '2000-02-31' }], 1, clock()), /Check each/);
  assert.equal(validatePassengers([passenger], 1, clock())[0].firstName, 'Sample');
});
test('checkout uses database fares, signed-in email, and opaque return references', async t => {
  const f = await fixture(t); await f.create();
  const request = f.checkoutRequests[0];
  assert.equal(request.line_items[0].price_data.unit_amount, 250000);
  assert.match(request.line_items[0].price_data.product_data.name, /^Flyhigh FH901/);
  assert.equal(request.customer_email, user.email);
  assert.match(request.success_url, /session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(request.cancel_url, /localhost:5173\/payment\/cancel\?order_id=/);
  assert.equal(request.success_url.includes(passenger.firstName), false);
  assert.equal(await f.remaining(), 3); assert.equal(await f.db.collection('Bookings').countDocuments(), 0);
});
test('failed checkout, unpaid confirmation and cancellation never book or deduct seats', async t => {
  const f = await fixture(t); f.setOutage(true);
  await assert.rejects(f.create(), /Stripe outage/); assert.equal(await f.remaining(), 3);
  f.setOutage(false); const checkout = await f.create();
  assert.equal((await f.service.confirm(checkout.sessionId, user)).status, 'unpaid');
  assert.equal((await f.service.cancel(checkout.orderId, user)).status, 'canceled');
  assert.equal((await f.service.confirm(checkout.sessionId, user)).status, 'expired');
  assert.equal(await f.remaining(), 3); assert.equal(await f.db.collection('Bookings').countDocuments(), 0);
});
test('successful test payment creates exactly one booking across concurrent refreshes', async t => {
  const f = await fixture(t); const checkout = await f.create(); f.pay(checkout.sessionId);
  const results = await Promise.all(Array.from({ length: 6 }, () => f.service.confirm(checkout.sessionId, user)));
  assert.ok(results.every(row => row.status === 'confirmed'));
  assert.equal(new Set(results.map(row => row.booking.bookingReference)).size, 1);
  assert.equal(await f.remaining(), 2); assert.equal(await f.db.collection('Bookings').countDocuments(), 1);
});
test('retrying a checkout request reuses its Stripe session and rejects changed passenger data', async t => {
  const f = await fixture(t); const first = await f.create(); const second = await f.create();
  assert.equal(first.orderId, second.orderId); assert.equal(f.checkoutRequests.length, 1);
  await assert.rejects(f.create({ ...f.body, formData: [{ ...passenger, firstName: 'Changed' }] }), /different details/);
});
test('another account cannot confirm, cancel or read someone else’s booking', async t => {
  const f = await fixture(t); const checkout = await f.create(); const stranger = { email: 'other@example.com' };
  await assert.rejects(f.service.confirm(checkout.sessionId, stranger), /not found/);
  await assert.rejects(f.service.cancel(checkout.orderId, stranger), /not found/);
  f.pay(checkout.sessionId); const result = await f.service.confirm(checkout.sessionId, user);
  await assert.rejects(f.service.getBooking(result.booking._id, stranger), /not found/);
});
test('mismatched amounts and live-mode sessions cannot produce bookings', async t => {
  const f = await fixture(t); const checkout = await f.create(); f.pay(checkout.sessionId);
  const session = f.sessions.get(checkout.sessionId); session.amount_total = 1;
  await assert.rejects(f.service.confirm(checkout.sessionId, user), /could not be verified/);
  session.amount_total = 250000; session.livemode = true;
  await assert.rejects(f.service.confirm(checkout.sessionId, user), /could not be verified/);
  assert.equal(await f.remaining(), 3); assert.equal(await f.db.collection('Bookings').countDocuments(), 0);
});
test('last-seat race refunds the losing test payment without overbooking', async t => {
  const f = await fixture(t, 1); const first = await f.create();
  const second = await f.create({ ...f.body, requestId: crypto.randomUUID() });
  f.pay(first.sessionId); f.pay(second.sessionId);
  const results = await Promise.all([f.service.confirm(first.sessionId, user), f.service.confirm(second.sessionId, user)]);
  assert.deepEqual(results.map(row => row.status).sort(), ['confirmed', 'refunded']);
  assert.equal(await f.remaining(), 0); assert.equal(await f.db.collection('Bookings').countDocuments(), 1); assert.equal(f.refunds.size, 1);
});
test('a database failure after allocation recovers without deducting seats twice', async t => {
  const f = await fixture(t); const checkout = await f.create(); f.pay(checkout.sessionId);
  await f.db.command({ collMod: 'Bookings', validator: { _id: { $type: 'objectId' } } });
  await assert.rejects(f.service.confirm(checkout.sessionId, user));
  assert.equal(await f.remaining(), 2);
  await f.db.command({ collMod: 'Bookings', validator: {} });
  assert.equal((await f.service.confirm(checkout.sessionId, user)).status, 'confirmed');
  assert.equal(await f.remaining(), 2); assert.equal(await f.db.collection('Bookings').countDocuments(), 1);
});
test('reconciliation saves a paid booking when the customer never returns from Stripe', async t => {
  const f = await fixture(t); const checkout = await f.create(); f.pay(checkout.sessionId);
  await f.service.reconcile(); await f.service.reconcile();
  assert.equal(await f.db.collection('Bookings').countDocuments(), 1); assert.equal(await f.remaining(), 2);
});
test('signed webhooks fulfill once; forged signatures never allocate inventory', async t => {
  const f = await fixture(t); const checkout = await f.create(); f.pay(checkout.sessionId);
  const payload = JSON.stringify({ id: 'evt_test_local', type: 'checkout.session.completed', livemode: false, data: { object: { id: checkout.sessionId } } });
  await assert.rejects(f.service.webhook(Buffer.from(payload), 'invalid'), /signature/);
  assert.equal(await f.remaining(), 3);
  const signature = f.stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_unit_only' });
  await f.service.webhook(Buffer.from(payload), signature); await f.service.webhook(Buffer.from(payload), signature);
  assert.equal(await f.remaining(), 2); assert.equal(await f.db.collection('Bookings').countDocuments(), 1);
});
test('live Stripe configuration is refused before a checkout is created', async t => {
  const f = await fixture(t);
  const liveService = createPaymentService({ db: f.db, stripe: f.stripe, testMode: false, allowedOrigins: [origin] });
  await assert.rejects(liveService.createCheckout(f.body, user, origin), /Live payments are disabled/);
  assert.equal(f.sessions.size, 0);
});
test('Flyhigh seeding is idempotent, uses India dates and preserves sold seats and history', async t => {
  const f = await fixture(t);
  await f.db.collection('Flights').insertOne({ flightNumber: 'AI100', flightName: 'Historical airline' });
  const historical = { _id: 'legacy-booking', email: user.email, data: { flightNumber: 'AI100' } };
  await f.db.collection('Bookings').insertOne(historical);
  await ensureFlyhighNetwork(f.db, new Date(clock()));
  const target = await f.db.collection('Flight Info').findOne({ flightNumber: 'FH101', departureDate: '2026-11-25' });
  await f.db.collection('Flight Info').updateOne({ _id: target._id }, { $inc: { 'seatsAvailable.economy': -2 } });
  await ensureFlyhighNetwork(f.db, new Date(clock()));
  assert.equal(await f.db.collection('Flight Info').countDocuments({ flightNumber: 'FH101', departureDate: '2026-11-25' }), 1);
  assert.equal((await f.db.collection('Flight Info').findOne({ _id: target._id })).seatsAvailable.economy, 58);
  assert.deepEqual(await f.db.collection('Bookings').findOne({ _id: historical._id }), historical);
  assert.equal(indiaDate(new Date('2026-11-23T20:00:00Z')), '2026-11-24');
});
