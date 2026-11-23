const crypto = require('node:crypto');
const { ObjectId } = require('mongodb');
const { AIRLINE, indiaDate, departureTimestamp } = require('./airline');

class PaymentError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function validatePassengers(formData, count, now) {
  if (!Number.isInteger(count) || count < 1 || count > 9 || !Array.isArray(formData) || formData.length !== count) throw new PaymentError(400, 'Provide details for between 1 and 9 passengers.');
  return formData.map(passenger => {
    const clean = Object.fromEntries(['title', 'firstName', 'lastName', 'gender', 'dob', 'mobile'].map(key => [key, typeof passenger?.[key] === 'string' ? passenger[key].trim() : '']));
    if (!clean.firstName || !clean.lastName || clean.firstName.length > 100 || clean.lastName.length > 100 || !['Mr', 'Mrs', 'Ms', 'Miss', 'Dr'].includes(clean.title) || !['Male', 'Female', 'Other'].includes(clean.gender) || !/^\d{10}$/.test(clean.mobile) || !/^\d{4}-\d{2}-\d{2}$/.test(clean.dob) || !Number.isFinite(Date.parse(clean.dob)) || new Date(clean.dob).toISOString().slice(0, 10) !== clean.dob || clean.dob > indiaDate(new Date(now))) {
      throw new PaymentError(400, 'Check each passenger’s name, date of birth, gender and 10-digit phone number.');
    }
    return clean;
  });
}

function createPaymentService({ db, stripe, testMode, allowedOrigins, webhookSecret, now = Date.now }) {
  const orders = db.collection('Checkout Orders');
  const schedules = db.collection('Flight Info');
  const bookings = db.collection('Bookings');
  let reconciling = false;

  function requireTestMode() {
    if (!testMode) throw new PaymentError(503, 'This learning project requires a Stripe test key. Live payments are disabled.');
  }
  async function ownedOrder(id, user) {
    if (typeof id !== 'string' || id.length > 100) throw new PaymentError(400, 'Invalid checkout reference.');
    const order = await orders.findOne({ _id: id });
    if (!order || order.email !== user.email) throw new PaymentError(404, 'Checkout not found for this account.');
    return order;
  }
  async function readSession(id) {
    if (typeof id !== 'string' || !/^cs_test_[A-Za-z0-9_]+$/.test(id) || id.length > 200) throw new PaymentError(400, 'A Stripe test Checkout Session is required.');
    return stripe.checkout.sessions.retrieve(id);
  }
  function matchSession(session, order) {
    if (session.livemode !== false || session.mode !== 'payment' || session.metadata?.orderId !== order._id || session.client_reference_id !== order._id || (order.sessionId && session.id !== order.sessionId) || session.amount_total !== order.amount || session.currency !== 'inr') throw new PaymentError(409, 'Payment details could not be verified against this booking.');
  }

  async function refundUnavailable(order, session) {
    const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (!intent) throw new PaymentError(409, 'The test payment needs reconciliation. Please retry shortly.');
    const refund = await stripe.refunds.create({ payment_intent: intent, metadata: { orderId: order._id } }, { idempotencyKey: `sold-out-${order._id}` });
    if (!['succeeded', 'pending'].includes(refund.status)) throw new PaymentError(409, 'The test refund needs reconciliation. Please retry shortly.');
    await orders.updateOne({ _id: order._id }, { $set: { status: 'refunded', refundId: refund.id } });
    return { status: 'refunded', message: 'This departure is no longer available. Your test payment has been refunded; no booking was created.' };
  }

  async function fulfill(session) {
    requireTestMode();
    const order = await orders.findOne({ _id: session.metadata?.orderId });
    if (!order) throw new PaymentError(404, 'Checkout record not found.');
    matchSession(session, order);
    if (session.payment_status !== 'paid' || session.status !== 'complete') {
      return { status: session.status === 'expired' ? 'expired' : 'unpaid', message: session.status === 'expired' ? 'This checkout has expired. No booking was created.' : 'Payment has not completed. No booking has been confirmed.' };
    }
    if (order.status === 'refunded') return { status: 'refunded', message: 'This test payment was refunded. No booking was created.' };
    const existingBooking = await bookings.findOne({ _id: order._id });
    if (existingBooking) return { status: 'confirmed', booking: existingBooking };
    const scheduleId = new ObjectId(order.data.scheduleId);
    let schedule = await schedules.findOne({ _id: scheduleId });
    const alreadyAllocated = schedule?.fulfilledOrders?.includes(order._id);
    if (!alreadyAllocated) {
      if (!schedule || (schedule.newdepTime || schedule.departureTime) !== order.data.departureTime || departureTimestamp(schedule.newdepTime || schedule.departureTime) <= now()) return refundUnavailable(order, session);
      await schedules.updateOne({ _id: scheduleId, operator: AIRLINE.operator, fulfilledOrders: { $ne: order._id }, [`seatsAvailable.${order.cabin}`]: { $gte: order.data.passengers } }, { $inc: { [`seatsAvailable.${order.cabin}`]: -order.data.passengers }, $addToSet: { fulfilledOrders: order._id } });
      schedule = await schedules.findOne({ _id: scheduleId });
      if (!schedule?.fulfilledOrders?.includes(order._id)) return refundUnavailable(order, session);
    }
    const booking = { _id: order._id, email: order.email, data: order.data, formData: order.formData, time: new Date(now()).toISOString(), bookingReference: order.bookingReference, stripeSessionId: session.id, payment: { provider: 'stripe', mode: 'test', status: 'paid', amount: order.amount, currency: 'inr', paymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id } };
    // The deterministic booking ID and the schedule's allocation marker make retries safe
    // even if the process stops between the seat update and booking insert.
    await bookings.updateOne({ _id: order._id }, { $setOnInsert: booking }, { upsert: true });
    await orders.updateOne({ _id: order._id }, { $set: { status: 'confirmed', sessionId: session.id } });
    return { status: 'confirmed', booking: await bookings.findOne({ _id: order._id }) };
  }

  async function createCheckout(body, user, origin) {
    requireTestMode();
    if (!allowedOrigins.includes(origin)) throw new PaymentError(400, 'Unsupported checkout return address.');
    const requestId = body?.requestId;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw new PaymentError(400, 'A valid checkout request ID is required.');
    const selection = body?.data || {};
    const count = Number(selection.passengers);
    const formData = validatePassengers(body?.formData, count, now());
    const cabin = String(selection.seat || '').toLowerCase();
    if (!['economy', 'business', 'first'].includes(cabin) || typeof selection.scheduleId !== 'string' || !ObjectId.isValid(selection.scheduleId)) throw new PaymentError(400, 'Select a Flyhigh departure and cabin again.');
    const requestHash = crypto.createHash('sha256').update(JSON.stringify({ scheduleId: selection.scheduleId, cabin, count, formData, origin })).digest('hex');
    const orderId = crypto.createHash('sha256').update(`${user.email}:${requestId}`).digest('hex');
    let order = await orders.findOne({ _id: orderId });
    if (order && order.requestHash !== requestHash) throw new PaymentError(409, 'This checkout request was already used for different details.');
    if (order?.status === 'confirmed') return { bookingId: order._id };
    if (order?.sessionId) {
      const session = await readSession(order.sessionId);
      matchSession(session, order);
      if (session.status === 'open') return { url: session.url, orderId };
      if (session.payment_status === 'paid') {
        const result = await fulfill(session);
        return { bookingId: result.booking?._id, status: result.status, message: result.message };
      }
      throw new PaymentError(409, 'This checkout has ended. Return to the booking details and try again.');
    }
    if (!order) {
      const schedule = await schedules.findOne({ _id: new ObjectId(selection.scheduleId), operator: AIRLINE.operator });
      if (!schedule || departureTimestamp(schedule.newdepTime || schedule.departureTime) <= now()) throw new PaymentError(409, 'This departure is no longer available. Search for another flight.');
      const route = await db.collection('Flights').findOne({ flightNumber: schedule.flightNumber, operator: AIRLINE.operator });
      const unitAmount = Math.round(Number(schedule.prices?.[cabin]) * 100);
      if (!route || !Number.isSafeInteger(unitAmount) || unitAmount < 100 || Number(schedule.seatsAvailable?.[cabin]) < count) throw new PaymentError(409, 'This cabin does not have enough available seats.');
      const data = { scheduleId: selection.scheduleId, flightName: AIRLINE.name, flightNumber: route.flightNumber, originAirport: route.originAirport, destinationAirport: route.destinationAirport, departureTime: schedule.newdepTime || schedule.departureTime, arrivalTime: schedule.newarrTime || schedule.arrivalTime, passengers: count, price: unitAmount / 100, seat: cabin[0].toUpperCase() + cabin.slice(1) };
      const proposed = { _id: orderId, email: user.email, requestHash, cabin, data, formData, amount: unitAmount * count, status: 'pending', bookingReference: `FH-${crypto.randomBytes(4).toString('hex').toUpperCase()}`, origin, createdAt: new Date(now()) };
      await orders.updateOne({ _id: orderId }, { $setOnInsert: proposed }, { upsert: true });
      order = await orders.findOne({ _id: orderId });
      if (order.requestHash !== requestHash) throw new PaymentError(409, 'This request was used for different booking details.');
    }
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', payment_method_types: ['card'], client_reference_id: order._id,
      metadata: { orderId: order._id }, payment_intent_data: { metadata: { orderId: order._id } }, customer_email: order.email,
      line_items: [{ price_data: { currency: 'inr', unit_amount: Math.round(order.data.price * 100), product_data: { name: `${AIRLINE.name} ${order.data.flightNumber} · ${order.data.seat}`, description: `${order.data.originAirport} → ${order.data.destinationAirport} · ${order.data.departureTime} · Learning project / test payment` } }, quantity: order.data.passengers }],
      success_url: `${order.origin}/eticket?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${order.origin}/payment/cancel?order_id=${order._id}`,
      expires_at: Math.floor(new Date(order.createdAt).getTime() / 1000) + 3600,
    }, { idempotencyKey: `checkout-${order._id}` });
    if (session.livemode !== false) throw new PaymentError(503, 'Live payments are disabled for this learning project.');
    await orders.updateOne({ _id: order._id }, { $set: { sessionId: session.id, status: 'checkout' } });
    return { url: session.url, orderId: order._id };
  }

  async function confirm(sessionId, user) {
    requireTestMode();
    const order = await orders.findOne({ sessionId });
    if (!order || order.email !== user.email) throw new PaymentError(404, 'Checkout not found for this account.');
    return fulfill(await readSession(sessionId));
  }
  async function cancel(orderId, user) {
    requireTestMode();
    const order = await ownedOrder(orderId, user);
    let session = await readSession(order.sessionId);
    matchSession(session, order);
    if (session.status === 'open') {
      try { session = await stripe.checkout.sessions.expire(session.id); }
      catch { session = await readSession(order.sessionId); }
    }
    if (session.payment_status === 'paid') return fulfill(session);
    if (session.status !== 'expired') throw new PaymentError(409, 'Payment is still being processed. Check its status again shortly.');
    await orders.updateOne({ _id: order._id, status: { $ne: 'confirmed' } }, { $set: { status: 'canceled' } });
    return { status: 'canceled', message: 'Checkout canceled. No booking was created or seats deducted.', selection: { data: order.data, formData: order.formData } };
  }
  async function getBooking(id, user) {
    if (typeof id !== 'string' || id.length > 100) throw new PaymentError(400, 'Invalid booking reference.');
    const booking = await bookings.findOne({ _id: ObjectId.isValid(id) ? new ObjectId(id) : id });
    if (!booking || (booking.email !== user.email && user.role !== 'admin')) throw new PaymentError(404, 'Booking not found for this account.');
    return booking;
  }
  async function webhook(body, signature) {
    requireTestMode();
    if (!webhookSecret) throw new PaymentError(503, 'Stripe webhook signing is not configured.');
    let event;
    try { event = stripe.webhooks.constructEvent(body, signature, webhookSecret); }
    catch { throw new PaymentError(400, 'Invalid Stripe webhook signature.'); }
    if (event.livemode) throw new PaymentError(400, 'Live events are disabled.');
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) await fulfill(await readSession(event.data.object.id));
    return { received: true };
  }
  async function reconcile() {
    if (!testMode || reconciling) return;
    reconciling = true;
    try {
      const pending = await orders.find({ status: { $in: ['pending', 'checkout'] }, sessionId: { $type: 'string' } }).limit(50).toArray();
      for (const order of pending) {
        try {
          const session = await readSession(order.sessionId);
          if (session.payment_status === 'paid') await fulfill(session);
          else if (session.status === 'expired') await orders.updateOne({ _id: order._id, status: { $ne: 'confirmed' } }, { $set: { status: 'expired' } });
        } catch { console.error('A Stripe test checkout will be retried during the next reconciliation.'); }
      }
    } finally { reconciling = false; }
  }
  return { createCheckout, confirm, cancel, getBooking, webhook, reconcile, fulfill };
}

module.exports = { createPaymentService, PaymentError, validatePassengers };
