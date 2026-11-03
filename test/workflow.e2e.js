/*
 * Opt-in API workflow test. It uses an isolated database supplied through
 * MONGO_URI, creates no browser fixtures, and drops only that isolated test
 * database in `finally`.
 *
 * Example (PowerShell):
 *   $env:MONGO_URI='mongodb://127.0.0.1:27017/mydoctor_workflow_e2e_unique'
 *   node test/workflow.e2e.js
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const config = require('../src/config/env');
const app = require('../src/app');
const User = require('../src/models/user.model');
const DoctorProfile = require('../src/models/doctorProfile.model');
const SubscriptionPlan = require('../src/models/subscriptionPlan.model');
const WeeklySchedule = require('../src/models/weeklySchedule.model');
const Appointment = require('../src/models/appointment.model');
const Conversation = require('../src/models/conversation.model');
const Pharmacy = require('../src/models/pharmacy.model');
const Product = require('../src/models/product.model');

const dayName = (date) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()];
const calendarDate = (date) => date.toISOString().slice(0, 10);
const clockHour = (date) => `${String(date.getUTCHours()).padStart(2, '0')}:00`;

const tokenFor = (user) => jwt.sign(
  { userId: user._id.toString(), role: user.role },
  config.JWT_SECRET,
  { expiresIn: '5m' }
);

const createApi = (baseUrl) => async (path, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  return { status: response.status, payload };
};

const expectOk = (result, label) => {
  assert.equal(result.status >= 200 && result.status < 300, true, `${label}: ${JSON.stringify(result.payload)}`);
  assert.equal(result.payload.success, true, `${label}: response was not successful`);
  return result.payload.data;
};

const listen = () => new Promise((resolve, reject) => {
  const server = http.createServer(app);
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server));
});

const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

const seed = async () => {
  const plan = await SubscriptionPlan.create({
    targetRole: 'DOCTOR',
    name: 'PREMIUM',
    price: 99,
    durationInDays: 30,
    status: 'ACTIVE',
  });
  const doctor = await User.create({
    role: 'DOCTOR',
    fullName: 'Workflow Doctor',
    email: 'workflow-doctor@example.test',
    password: 'not-used-by-this-test',
    status: 'APPROVED',
    subscriptionPlan: plan._id,
    subscriptionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  const patient = await User.create({
    role: 'PATIENT',
    fullName: 'Workflow Patient',
    email: 'workflow-patient@example.test',
    password: 'not-used-by-this-test',
    status: 'APPROVED',
  });
  const pharmacy = await User.create({
    role: 'PHARMACY',
    fullName: 'Workflow Pharmacy',
    email: 'workflow-pharmacy@example.test',
    password: 'not-used-by-this-test',
    status: 'APPROVED',
  });
  const parapharmacy = await User.create({
    role: 'PARAPHARMACY',
    fullName: 'Workflow Parapharmacy',
    email: 'workflow-parapharmacy@example.test',
    password: 'not-used-by-this-test',
    status: 'APPROVED',
  });
  const profile = await DoctorProfile.create({
    userId: doctor._id,
    title: 'Dr',
    biography: 'Workflow test profile',
    services: [{ name: 'Consultation', price: 20 }],
    consultationFees: { clinic: 30, online: 50 },
    profileCompleted: true,
  });
  doctor.doctorProfile = profile._id;
  await doctor.save();

  const parapharmacyProfile = await Pharmacy.create({
    ownerId: parapharmacy._id,
    kind: 'PARAPHARMACY',
    name: 'Workflow Para Store',
  });
  const product = await Product.create({
    sellerId: parapharmacy._id,
    sellerType: 'PARAPHARMACY',
    name: 'Workflow Health Product',
    price: 12,
    images: ['/uploads/products/workflow-product.jpg'],
    stock: 10,
    category: 'Health',
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    .map((dayOfWeek) => ({ dayOfWeek, timeSlots: [{ startTime: '00:00', endTime: '23:59', isAvailable: true }] }));
  await WeeklySchedule.create({ doctorId: doctor._id, appointmentDuration: 60, days });
  return { doctor, patient, pharmacy, parapharmacy, parapharmacyProfile, product };
};

const main = async () => {
  if (!/workflow_e2e/i.test(config.MONGO_URI)) {
    throw new Error('Refusing to run: MONGO_URI must name an isolated database containing "workflow_e2e".');
  }

  let server;
  try {
    await mongoose.connect(config.MONGO_URI);
    await mongoose.connection.dropDatabase();
    await Promise.all([Appointment.syncIndexes(), Conversation.syncIndexes()]);

    const { doctor, patient, pharmacy, parapharmacy, product } = await seed();
    const doctorToken = tokenFor(doctor);
    const patientToken = tokenFor(patient);
    const pharmacyToken = tokenFor(pharmacy);
    const parapharmacyToken = tokenFor(parapharmacy);

    server = await listen();
    const address = server.address();
    const api = createApi(`http://127.0.0.1:${address.port}/api`);

    const now = new Date();
    if (now.getUTCHours() === 23) {
      throw new Error('Run this workflow test outside the final UTC hour; the test schedule intentionally ends at 23:59.');
    }
    const appointmentDate = calendarDate(now);
    const appointmentTime = clockHour(now);
    assert.equal(dayName(now).length > 0, true);

    const slots = expectOk(await api(`/weekly-schedule/slots?doctorId=${doctor._id}&date=${appointmentDate}`), 'availability endpoint');
    assert.equal(slots.some((slot) => slot.startTime === appointmentTime && slot.endTime), true, 'current appointment slot is offered');

    const quote = expectOk(await api('/appointment/quote', {
      method: 'POST', token: patientToken,
      body: { doctorId: doctor._id.toString(), bookingType: 'ONLINE', selectedServices: ['Consultation'] },
    }), 'server quote');
    assert.equal(quote.totalAmount, 70, 'quote combines consultation fee and selected service');

    const booking = {
      doctorId: doctor._id.toString(),
      patientId: patient._id.toString(),
      appointmentDate,
      appointmentTime,
      bookingType: 'ONLINE',
      selectedServices: ['Consultation'],
      timezone: 'UTC',
      timezoneOffset: 0,
    };
    const [firstCreate, secondCreate] = await Promise.all([
      api('/appointment', { method: 'POST', token: patientToken, body: booking }),
      api('/appointment', { method: 'POST', token: patientToken, body: booking }),
    ]);
    const created = [firstCreate, secondCreate].find((result) => result.status >= 200 && result.status < 300);
    const rejected = [firstCreate, secondCreate].find((result) => result !== created);
    const appointment = expectOk(created, 'one concurrent appointment booking');
    assert.equal(rejected.status, 409, 'the conflicting concurrent booking is rejected');
    assert.equal(appointment.status, 'PENDING_PAYMENT');
    assert.equal(appointment.appointmentEndTime, `${String((now.getUTCHours() + 1) % 24).padStart(2, '0')}:00`);

    const slotsAfterBooking = expectOk(await api(`/weekly-schedule/slots?doctorId=${doctor._id}&date=${appointmentDate}`), 'availability after booking');
    assert.equal(slotsAfterBooking.some((slot) => slot.startTime === appointmentTime), false, 'booked slot is no longer offered');

    const transaction = expectOk(await api('/payment/appointment', {
      method: 'POST', token: patientToken,
      body: { appointmentId: appointment._id, amount: 0.01, paymentMethod: 'DUMMY' },
    }), 'checkout payment');
    assert.equal(transaction.amount, 70, 'payment amount is derived from the server quote, not the client amount');

    const patientViewAfterPayment = expectOk(await api(`/appointment/${appointment._id}`, { token: patientToken }), 'patient appointment after payment');
    assert.equal(patientViewAfterPayment.paymentStatus, 'PAID');
    assert.equal(patientViewAfterPayment.status, 'PENDING');

    const confirmed = expectOk(await api(`/appointment/${appointment._id}/accept`, { method: 'POST', token: doctorToken }), 'doctor confirmation');
    assert.equal(confirmed.status, 'CONFIRMED');
    const [patientView, doctorView] = await Promise.all([
      api(`/appointment/${appointment._id}`, { token: patientToken }),
      api(`/appointment/${appointment._id}`, { token: doctorToken }),
    ]);
    const patientAppointment = expectOk(patientView, 'patient appointment view');
    const doctorAppointment = expectOk(doctorView, 'doctor appointment view');
    assert.deepEqual(
      [patientAppointment.appointmentDate, patientAppointment.appointmentTime, patientAppointment.appointmentEndTime, patientAppointment.status],
      [doctorAppointment.appointmentDate, doctorAppointment.appointmentTime, doctorAppointment.appointmentEndTime, doctorAppointment.status],
      'both participants see identical scheduling information'
    );

    const patientCall = expectOk(await api('/video/start', { method: 'POST', token: patientToken, body: { appointmentId: appointment._id } }), 'patient starts a video call');
    assert.equal(patientCall.session.status, 'RINGING');
    const doctorIncoming = expectOk(await api('/video/incoming', { token: doctorToken }), 'doctor incoming-call poll');
    assert.equal(doctorIncoming.sessions.some((session) => session._id === patientCall.sessionId), true, 'doctor receives ringing notification');
    const accepted = expectOk(await api('/video/accept', { method: 'POST', token: doctorToken, body: { sessionId: patientCall.sessionId } }), 'doctor accepts call');
    assert.equal(accepted.session.status, 'ACTIVE');
    const ended = expectOk(await api('/video/end', { method: 'POST', token: doctorToken, body: { sessionId: patientCall.sessionId } }), 'doctor ends call');
    assert.equal(ended.status, 'ENDED');

    const doctorCall = expectOk(await api('/video/start', { method: 'POST', token: doctorToken, body: { appointmentId: appointment._id } }), 'doctor starts a video call');
    const patientIncoming = expectOk(await api('/video/incoming', { token: patientToken }), 'patient incoming-call poll');
    assert.equal(patientIncoming.sessions.some((session) => session._id === doctorCall.sessionId), true, 'patient receives ringing notification');
    const declined = expectOk(await api('/video/end', { method: 'POST', token: patientToken, body: { sessionId: doctorCall.sessionId } }), 'patient declines call');
    assert.equal(declined.status, 'DECLINED');

    const firstConversation = expectOk(await api('/chat/conversation', {
      method: 'POST', token: patientToken,
      body: { doctorId: doctor._id.toString(), patientId: patient._id.toString(), appointmentId: appointment._id },
    }), 'patient opens appointment chat');
    const reusedConversation = expectOk(await api('/chat/conversation', {
      method: 'POST', token: doctorToken,
      body: { doctorId: doctor._id.toString(), patientId: patient._id.toString(), appointmentId: appointment._id },
    }), 'doctor reopens appointment chat');
    assert.equal(reusedConversation._id, firstConversation._id, 'doctor and patient reuse one conversation');

    expectOk(await api('/chat/send', {
      method: 'POST', token: patientToken,
      body: { doctorId: doctor._id.toString(), patientId: patient._id.toString(), appointmentId: appointment._id, message: 'Hello doctor' },
    }), 'patient message');
    const completed = expectOk(await api(`/chat/conversations/${firstConversation._id}/complete`, { method: 'POST', token: doctorToken }), 'doctor completes conversation');
    assert.equal(completed.status, 'COMPLETED');
    const blockedMessage = await api('/chat/send', {
      method: 'POST', token: patientToken,
      body: { doctorId: doctor._id.toString(), patientId: patient._id.toString(), appointmentId: appointment._id, message: 'This should fail' },
    });
    assert.equal(blockedMessage.status >= 400, true, 'completed conversation rejects further messages');
    const history = expectOk(await api('/chat/conversations', { token: patientToken }), 'patient chat history');
    const historyConversation = history.conversations.find((conversation) => conversation._id === firstConversation._id);
    assert.equal(historyConversation?.status, 'COMPLETED', 'completed conversation remains visible in history');

    // A later appointment with the same doctor must continue the relationship
    // history rather than create a second chat row.  This direct fixture is
    // intentionally in the past so chat availability is valid in every run.
    const priorDay = new Date(now);
    priorDay.setUTCDate(priorDay.getUTCDate() - 1);
    const followUpAppointment = await Appointment.create({
      doctorId: doctor._id,
      patientId: patient._id,
      appointmentDate: new Date(Date.UTC(priorDay.getUTCFullYear(), priorDay.getUTCMonth(), priorDay.getUTCDate())),
      appointmentTime: '12:00',
      appointmentEndTime: '13:00',
      appointmentDuration: 60,
      bookingType: 'ONLINE',
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      selectedServices: [{ name: 'Consultation', price: 20 }],
      totalAmount: 70,
    });
    const resumedConversation = expectOk(await api('/chat/conversation', {
      method: 'POST', token: patientToken,
      body: { doctorId: doctor._id.toString(), patientId: patient._id.toString(), appointmentId: followUpAppointment._id.toString() },
    }), 'follow-up appointment reuses relationship chat');
    assert.equal(resumedConversation._id, firstConversation._id, 'two appointments with the same doctor share one conversation');
    assert.equal(resumedConversation.status, 'ACTIVE', 'a later confirmed appointment reopens the completed relationship chat');
    assert.equal(
      (resumedConversation.appointmentIds || []).map(String).includes(followUpAppointment._id.toString()),
      true,
      'the canonical conversation retains its follow-up appointment link'
    );

    const order = expectOk(await api('/orders', {
      method: 'POST', token: patientToken,
      body: {
        items: [{ productId: product._id.toString(), quantity: 1 }],
        shippingAddress: { line1: '1 Test Street', city: 'Berlin', state: 'Berlin', country: 'DE', zip: '10115' },
      },
    }), 'patient creates product order');
    const newOrderCount = expectOk(await api('/orders/unread-count', { token: parapharmacyToken }), 'parapharmacy unread order count');
    assert.equal(newOrderCount.unreadCount, 1, 'the parapharmacy sidebar receives one new order indicator');
    const parapharmacyOrders = expectOk(await api('/orders?limit=10', { token: parapharmacyToken }), 'parapharmacy views order list');
    const listedProduct = parapharmacyOrders.orders?.find((entry) => entry._id === order._id)?.items?.[0]?.productId;
    assert.equal(listedProduct?.name, 'Workflow Health Product', 'order lists include the product name');
    assert.equal(listedProduct?.images?.[0], '/uploads/products/workflow-product.jpg', 'order lists include the product image');
    const viewedOrderCount = expectOk(await api('/orders/unread-count', { token: parapharmacyToken }), 'parapharmacy count after viewing orders');
    assert.equal(viewedOrderCount.unreadCount, 0, 'viewing the order list clears only the relevant seller count');
    expectOk(await api(`/orders/${order._id}/shipping`, {
      method: 'PUT', token: parapharmacyToken, body: { shippingFee: 6 },
    }), 'parapharmacy updates shipping');
    const patientOrderUpdateCount = expectOk(await api('/orders/unread-count', { token: patientToken }), 'patient unread order update count');
    assert.equal(patientOrderUpdateCount.unreadCount, 1, 'the patient receives the shipping-update indicator');
    expectOk(await api('/orders?limit=10', { token: patientToken }), 'patient views order history');
    const patientViewedOrderCount = expectOk(await api('/orders/unread-count', { token: patientToken }), 'patient count after viewing orders');
    assert.equal(patientViewedOrderCount.unreadCount, 0, 'viewing order history clears the patient order indicator');
    const pharmacyOrderCount = expectOk(await api('/orders/unread-count', { token: pharmacyToken }), 'pharmacy unread order count');
    assert.equal(pharmacyOrderCount.unreadCount, 0, 'a separate pharmacy sees no unrelated order indicator');

    console.log('PASS: booking, checkout, scheduling, video ringing, canonical chat, and role-scoped order updates');
  } finally {
    if (server) await close(server);
    if (mongoose.connection.readyState) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  }
};

main().catch((error) => {
  console.error('WORKFLOW E2E FAILED:', error);
  process.exitCode = 1;
});
