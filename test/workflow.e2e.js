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
const fs = require('node:fs');
const path = require('node:path');
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
const Notification = require('../src/models/notification.model');
const Pharmacy = require('../src/models/pharmacy.model');
const Product = require('../src/models/product.model');
const SupportTicket = require('../src/models/supportTicket.model');
const { sendUpcomingAppointmentNotifications } = require('../src/services/appointmentNotification.service');

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

const createMultipartApi = (baseUrl) => async (route, { token, formData } = {}) => {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData,
  });
  return { status: response.status, payload: await response.json() };
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
  const pharmacyPlan = await SubscriptionPlan.create({
    targetRole: 'PHARMACY',
    name: 'STARTER',
    price: 29,
    durationInDays: 30,
    status: 'ACTIVE',
  });
  const admin = await User.create({
    role: 'ADMIN',
    fullName: 'Workflow Admin',
    email: 'workflow-admin@example.test',
    password: 'not-used-by-this-test',
    status: 'APPROVED',
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
    phone: '+49-30-555-0100',
    address: { line1: '12 Health Avenue', city: 'Berlin', state: 'Berlin', country: 'DE', zip: '10115' },
  });
  const pharmacyProfile = await Pharmacy.create({
    ownerId: pharmacy._id,
    kind: 'PHARMACY',
    name: 'Workflow Pharmacy Store',
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
  const prescriptionProduct = await Product.create({
    sellerId: parapharmacy._id,
    sellerType: 'PARAPHARMACY',
    name: 'Workflow Prescription Medicine',
    description: 'A variant-based medicine used by the prescription workflow test.',
    price: 14,
    discountPrice: 12,
    images: ['/uploads/products/workflow-prescription-product.jpg'],
    stock: 12,
    category: 'Medicine',
    productType: 'PARAPHARMACY_PRODUCT',
    requiresPrescription: true,
    parapharmacyDetails: { ingredients: 'Workflow active ingredients', usageInstructions: 'Use exactly as prescribed.' },
    variants: [{
      name: '20-tablet pack',
      sku: 'WF-RX-20',
      price: 14,
      discountPrice: 12,
      stock: 12,
      packageType: 'Box',
      unitsPerPack: 20,
      unitLabel: 'tablets',
      isDefault: true,
      isActive: true,
    }],
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    .map((dayOfWeek) => ({ dayOfWeek, timeSlots: [{ startTime: '00:00', endTime: '23:59', isAvailable: true }] }));
  await WeeklySchedule.create({ doctorId: doctor._id, appointmentDuration: 60, days });
  return {
    admin, doctor, patient, pharmacy, parapharmacy, pharmacyPlan,
    pharmacyProfile, parapharmacyProfile, product, prescriptionProduct,
  };
};

const main = async () => {
  if (!/workflow_e2e/i.test(config.MONGO_URI)) {
    throw new Error('Refusing to run: MONGO_URI must name an isolated database containing "workflow_e2e".');
  }

  let server;
  try {
    await mongoose.connect(config.MONGO_URI);
    await mongoose.connection.dropDatabase();
    await Promise.all([Appointment.syncIndexes(), Conversation.syncIndexes(), SupportTicket.syncIndexes()]);

    const {
      admin, doctor, patient, pharmacy, parapharmacy, pharmacyPlan,
      pharmacyProfile, product, prescriptionProduct,
    } = await seed();
    const adminToken = tokenFor(admin);
    const doctorToken = tokenFor(doctor);
    const patientToken = tokenFor(patient);
    const pharmacyToken = tokenFor(pharmacy);
    const parapharmacyToken = tokenFor(parapharmacy);

    server = await listen();
    const address = server.address();
    const api = createApi(`http://127.0.0.1:${address.port}/api`);
    const multipartApi = createMultipartApi(`http://127.0.0.1:${address.port}/api`);

    // Verification uploads accept professional document formats on the
    // backend, report a precise validation response, persist document types,
    // and no longer surface as a generic client-side network failure.
    const documentUpload = new FormData();
    documentUpload.append('files', new Blob(['workflow credential'], { type: 'application/pdf' }), 'medical-registration.pdf');
    documentUpload.append('docType', 'MEDICAL_REGISTRATION_CERTIFICATE');
    const uploadedDocument = expectOk(await multipartApi('/upload/doctor-docs', { token: doctorToken, formData: documentUpload }), 'doctor verification document upload');
    assert.equal(uploadedDocument.urls.length, 1, 'doctor document upload returns its saved URL');
    const doctorAfterUpload = await User.findById(doctor._id).lean();
    assert.equal(doctorAfterUpload.documentUploads.at(-1).type, 'MEDICAL_REGISTRATION_CERTIFICATE', 'uploaded verification document retains its type');
    const uploadedPath = path.join(process.cwd(), uploadedDocument.urls[0].replace(/^\/uploads\//, 'uploads/'));
    assert.equal(fs.existsSync(uploadedPath), true, 'verification document is stored by the backend');
    fs.unlinkSync(uploadedPath);
    const oversizedDocument = new FormData();
    oversizedDocument.append('files', new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: 'application/pdf' }), 'too-large.pdf');
    const oversizedResponse = await multipartApi('/upload/doctor-docs', { token: doctorToken, formData: oversizedDocument });
    assert.equal(oversizedResponse.status, 400, 'oversized verification document receives a validation response');
    assert.equal(oversizedResponse.payload.message, 'File too large', 'oversized document receives a clear size error');

    // Setup is server-backed, which makes the pharmacy/parapharmacy prompt
    // durable across browser sessions instead of a dismissible UI flag.
    const incompletePharmacySetup = expectOk(await api('/pharmacy/setup-status', { token: pharmacyToken }), 'new pharmacy setup status');
    assert.equal(incompletePharmacySetup.profileCompleted, false, 'new pharmacy must complete its profile');
    assert.equal(incompletePharmacySetup.hasActiveSubscription, false, 'new pharmacy must activate a subscription');
    const completeParapharmacySetup = expectOk(await api('/pharmacy/setup-status', { token: parapharmacyToken }), 'parapharmacy setup status');
    assert.equal(completeParapharmacySetup.isSetupComplete, true, 'parapharmacy setup has no subscription requirement');
    assert.equal(completeParapharmacySetup.requiresSubscription, false, 'parapharmacy never requires a subscription');
    expectOk(await api(`/pharmacy/${pharmacyProfile._id}`, {
      method: 'PUT', token: pharmacyToken,
      body: {
        name: 'Workflow Pharmacy Store', phone: '+49-30-555-0101',
        address: { line1: '13 Health Avenue', city: 'Berlin', state: 'Berlin', country: 'DE', zip: '10116' },
      },
    }), 'pharmacy completes its business profile');
    const profileOnlySetup = expectOk(await api('/pharmacy/setup-status', { token: pharmacyToken }), 'profile-complete pharmacy setup');
    assert.equal(profileOnlySetup.profileCompleted, true, 'profile completion persists');
    assert.equal(profileOnlySetup.isSetupComplete, false, 'subscription is still required for pharmacy');
    expectOk(await api('/pharmacy/buy-subscription', { method: 'POST', token: pharmacyToken, body: { planId: pharmacyPlan._id.toString() } }), 'pharmacy activates subscription');
    const activatedPharmacySetup = expectOk(await api('/pharmacy/setup-status', { token: pharmacyToken }), 'activated pharmacy setup');
    assert.equal(activatedPharmacySetup.isSetupComplete, true, 'completed pharmacy setup remains complete after server refresh');

    const richProduct = expectOk(await api('/products', {
      method: 'POST', token: pharmacyToken,
      body: {
        name: 'Workflow Variant Medicine', price: 10, stock: 9,
        description: 'Detailed product created through the pharmacy product API.',
        productType: 'PHARMACY_MEDICINE', category: 'Wellness', brand: 'Workflow',
        images: ['/uploads/products/workflow-variant-product.jpg'],
        medicineDetails: { activeIngredients: 'Workflow ingredient', dosageInstructions: 'Use as directed.' },
        variants: [
          { name: '50 ml bottle', price: 10, stock: 5, packageType: 'Bottle', unitsPerPack: 50, unitLabel: 'ml', isDefault: true },
          { name: '100 ml bottle', price: 18, discountPrice: 15, stock: 4, packageType: 'Bottle', unitsPerPack: 100, unitLabel: 'ml' },
        ],
      },
    }), 'pharmacy creates detailed product with variants');
    assert.equal(richProduct.variants.length, 2, 'both product variants are persisted');
    const richProductView = expectOk(await api(`/products/${richProduct._id}`), 'patient product detail receives all saved information');
    assert.equal(richProductView.variants[1].discountPrice, 15, 'variant sale price is returned to patient product pages');
    assert.equal(richProductView.shippingSettings, undefined, 'product details do not expose fixed seller shipping settings');

    const now = new Date();
    const appointmentDate = calendarDate(now);
    // The test doctor works until 23:59. In the final UTC hour, use a
    // valid 22:00 slot in a UTC-01:00 device zone: its real-time call window
    // is 23:00–00:00 UTC, so the same workflow remains executable at any
    // time of day without relaxing schedule validation.
    const isFinalUtcHour = now.getUTCHours() === 23;
    const appointmentTime = isFinalUtcHour ? '22:00' : clockHour(now);
    const appointmentTimezone = isFinalUtcHour ? 'Etc/GMT+1' : 'UTC';
    const appointmentTimezoneOffset = isFinalUtcHour ? -60 : 0;
    assert.equal(dayName(now).length > 0, true);

    // Exercise the real doctor schedule API and database persistence with
    // multiple independent ranges. Pick a different weekday so this focused
    // availability check cannot alter the current-hour booking below.
    const availabilityProbe = new Date(now);
    availabilityProbe.setUTCDate(availabilityProbe.getUTCDate() + 2);
    const availabilityDay = dayName(availabilityProbe);
    const availabilityDate = calendarDate(availabilityProbe);
    expectOk(await api('/weekly-schedule', {
      method: 'POST', token: doctorToken,
      body: {
        dayOfWeek: availabilityDay,
        timeSlots: [
          { startTime: '09:45', endTime: '10:45', isAvailable: true },
          { startTime: '17:00', endTime: '18:00', isAvailable: true },
        ],
      },
    }), 'doctor saves separate availability ranges');
    const exactSlots = expectOk(await api(`/weekly-schedule/slots?doctorId=${doctor._id}&date=${availabilityDate}`), 'exact availability endpoint');
    assert.deepEqual(
      exactSlots.map((slot) => slot.startTime),
      ['09:45', '17:00'],
      'availability preserves non-aligned range starts and never mixes daily ranges'
    );
    const overlappingRange = await api(`/weekly-schedule/day/${availabilityDay}/slot`, {
      method: 'POST', token: doctorToken,
      body: { startTime: '10:15', endTime: '11:15', isAvailable: true },
    });
    assert.equal(overlappingRange.status, 400, 'overlapping availability ranges are rejected at the API boundary');

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
      timezone: appointmentTimezone,
      timezoneOffset: appointmentTimezoneOffset,
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
    assert.equal(appointment.appointmentEndTime, isFinalUtcHour ? '23:00' : `${String((now.getUTCHours() + 1) % 24).padStart(2, '0')}:00`);

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

    // A UTC device zone is intentionally different from the server's local
    // zone. The worker must calculate the reminder from the stored zone and
    // send it once to each participant.
    const reminderStart = new Date(Date.now() + 10 * 60 * 1000);
    const reminderAppointment = await Appointment.create({
      doctorId: doctor._id,
      patientId: patient._id,
      appointmentDate: new Date(Date.UTC(
        reminderStart.getUTCFullYear(),
        reminderStart.getUTCMonth(),
        reminderStart.getUTCDate()
      )),
      appointmentTime: `${String(reminderStart.getUTCHours()).padStart(2, '0')}:${String(reminderStart.getUTCMinutes()).padStart(2, '0')}`,
      appointmentDuration: 30,
      bookingType: 'ONLINE',
      timezone: 'UTC',
      timezoneOffset: 0,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
    });
    const reminderResult = await sendUpcomingAppointmentNotifications();
    assert.equal(reminderResult.sent, 2, 'the device-zone appointment sends one reminder to doctor and patient');
    assert.equal(
      await Notification.countDocuments({
        'data.appointmentId': String(reminderAppointment._id),
        'data.action': 'APPOINTMENT_REMINDER_10_MIN',
      }),
      2,
      'the reminder is persisted once per participant'
    );
    assert.equal((await sendUpcomingAppointmentNotifications()).sent, 0, 'the reminder worker does not create duplicate notifications');

    const order = expectOk(await api('/orders', {
      method: 'POST', token: patientToken,
      body: {
        items: [{ productId: product._id.toString(), quantity: 1 }],
        shippingAddress: { line1: '1 Test Street', city: 'Berlin', state: 'Berlin', country: 'DE', zip: '10115' },
      },
    }), 'patient creates product order');
    assert.equal(order.finalShipping, null, 'a new order has no seller shipping quote');
    assert.equal(order.promisedDeliveryDays, null, 'a new order has no delivery commitment');
    const blockedUnquotedPayment = await api(`/orders/${order._id}/pay`, {
      method: 'POST', token: patientToken, body: { paymentMethod: 'STRIPE' },
    });
    assert.equal(blockedUnquotedPayment.status, 400, 'the patient cannot pay before the seller supplies an order-specific quote');
    const newOrderCount = expectOk(await api('/orders/unread-count', { token: parapharmacyToken }), 'parapharmacy unread order count');
    assert.equal(newOrderCount.unreadCount, 1, 'the parapharmacy sidebar receives one new order indicator');
    const parapharmacyOrders = expectOk(await api('/orders?limit=10', { token: parapharmacyToken }), 'parapharmacy views order list');
    const listedProduct = parapharmacyOrders.orders?.find((entry) => entry._id === order._id)?.items?.[0]?.productId;
    assert.equal(listedProduct?.name, 'Workflow Health Product', 'order lists include the product name');
    assert.equal(listedProduct?.images?.[0], '/uploads/products/workflow-product.jpg', 'order lists include the product image');
    const viewedOrderCount = expectOk(await api('/orders/unread-count', { token: parapharmacyToken }), 'parapharmacy count after viewing orders');
    assert.equal(viewedOrderCount.unreadCount, 0, 'viewing the order list clears only the relevant seller count');
    const invalidDeliveryCommitment = await api(`/orders/${order._id}/shipping`, {
      method: 'PUT', token: parapharmacyToken, body: { shippingFee: 6, deliveryDays: 1 },
    });
    assert.equal(invalidDeliveryCommitment.status, 400, 'the seller must choose a 2–5 day delivery commitment');
    const quotedOrder = expectOk(await api(`/orders/${order._id}/shipping`, {
      method: 'PUT', token: parapharmacyToken, body: { shippingFee: 6, deliveryDays: 3 },
    }), 'parapharmacy sets this order’s shipping and delivery commitment');
    assert.equal(quotedOrder.finalShipping, 6, 'the order stores its own shipping fee');
    assert.equal(quotedOrder.promisedDeliveryDays, 3, 'the order stores its own delivery commitment');
    assert.ok(quotedOrder.expectedDeliveryDate, 'the order receives an expected delivery date');
    const patientOrderUpdateCount = expectOk(await api('/orders/unread-count', { token: patientToken }), 'patient unread order update count');
    assert.equal(patientOrderUpdateCount.unreadCount, 1, 'the patient receives the shipping-update indicator');
    expectOk(await api('/orders?limit=10', { token: patientToken }), 'patient views order history');
    const patientViewedOrderCount = expectOk(await api('/orders/unread-count', { token: patientToken }), 'patient count after viewing orders');
    assert.equal(patientViewedOrderCount.unreadCount, 0, 'viewing order history clears the patient order indicator');
    const pharmacyOrderCount = expectOk(await api('/orders/unread-count', { token: pharmacyToken }), 'pharmacy unread order count');
    assert.equal(pharmacyOrderCount.unreadCount, 0, 'a separate pharmacy sees no unrelated order indicator');
    const paidOrder = expectOk(await api(`/orders/${order._id}/pay`, {
      method: 'POST', token: patientToken, body: { paymentMethod: 'STRIPE' },
    }), 'patient pays after the seller quote');
    assert.equal(paidOrder.paymentStatus, 'PAID', 'the quoted order becomes paid');

    // Prescription-only products reject an order until the seller reviews the
    // exact selected option. Approval then unlocks only that patient/product
    // option and preserves the selected variant, delivery address, shipping
    // fee and delivery commitment on the resulting order.
    const prescriptionVariant = prescriptionProduct.variants[0];
    const beforePrescription = expectOk(await api(`/product-prescription-requests/product/${prescriptionProduct._id}/eligibility?variantId=${prescriptionVariant._id}`, { token: patientToken }), 'prescription eligibility before upload');
    assert.equal(beforePrescription.status, 'NOT_SUBMITTED');
    const blockedPrescriptionOrder = await api('/orders', {
      method: 'POST', token: patientToken,
      body: {
        items: [{ productId: prescriptionProduct._id.toString(), variantId: prescriptionVariant._id.toString(), quantity: 2 }],
        shippingAddress: { line1: '5 Patient Street', city: 'Berlin', state: 'Berlin', country: 'DE', zip: '10117' },
      },
    });
    assert.equal(blockedPrescriptionOrder.status, 403, 'prescription products cannot be ordered before approval');
    const prescriptionRequest = expectOk(await api('/product-prescription-requests', {
      method: 'POST', token: patientToken,
      body: {
        productId: prescriptionProduct._id.toString(), variantId: prescriptionVariant._id.toString(),
        prescriptionUrl: '/uploads/prescriptions/workflow-prescription.pdf', originalName: 'workflow-prescription.pdf', mimeType: 'application/pdf',
      },
    }), 'patient submits prescription for selected variant');
    const sellerRequests = expectOk(await api('/product-prescription-requests/seller?status=PENDING', { token: parapharmacyToken }), 'seller sees submitted prescription');
    assert.equal(sellerRequests.requests.some((request) => request._id === prescriptionRequest._id), true, 'prescription appears in the correct seller account');
    const approvedPrescription = expectOk(await api(`/product-prescription-requests/${prescriptionRequest._id}/review`, {
      method: 'PUT', token: parapharmacyToken, body: { status: 'APPROVED', reviewNotes: 'Verified by workflow test' },
    }), 'seller approves prescription');
    assert.equal(approvedPrescription.status, 'APPROVED');
    assert.equal(await Notification.countDocuments({
      userId: patient._id,
      type: 'PRESCRIPTION_APPROVED',
      'data.prescriptionRequestId': String(prescriptionRequest._id),
    }), 1, 'approval creates one durable patient purchase-ready notification');
    const approvedEligibility = expectOk(await api(`/product-prescription-requests/product/${prescriptionProduct._id}/eligibility?variantId=${prescriptionVariant._id}`, { token: patientToken }), 'prescription eligibility after approval');
    assert.equal(approvedEligibility.canPurchase, true, 'approved prescription unlocks checkout');
    const prescriptionOrder = expectOk(await api('/orders', {
      method: 'POST', token: patientToken,
      body: {
        items: [{ productId: prescriptionProduct._id.toString(), variantId: prescriptionVariant._id.toString(), quantity: 2 }],
        shippingAddress: { line1: '5 Patient Street', line2: 'Apartment 4', city: 'Berlin', state: 'Berlin', country: 'DE', zip: '10117' },
      },
    }), 'patient creates approved prescription order');
    assert.equal(prescriptionOrder.items[0].variantName, '20-tablet pack', 'order snapshots the chosen product variant');
    assert.equal(prescriptionOrder.shipping, 0, 'the approved order begins without a fixed seller shipping fee');
    assert.equal(prescriptionOrder.finalShipping, null, 'the approved order waits for an order-specific seller quote');
    assert.equal(prescriptionOrder.promisedDeliveryDays, null, 'the approved order waits for a seller delivery commitment');
    assert.equal(prescriptionOrder.shippingAddress.line1, '5 Patient Street', 'patient delivery address is saved on order');
    const patientPrescriptionOrder = expectOk(await api(`/orders/${prescriptionOrder._id}`, { token: patientToken }), 'patient order details include delivery address');
    const sellerPrescriptionOrder = expectOk(await api(`/orders/${prescriptionOrder._id}`, { token: parapharmacyToken }), 'seller order details include delivery address');
    assert.equal(patientPrescriptionOrder.shippingAddress.zip, '10117', 'patient sees complete delivery address');
    assert.equal(sellerPrescriptionOrder.shippingAddress.line2, 'Apartment 4', 'seller sees complete delivery address');
    const blockedPrescriptionPayment = await api(`/orders/${prescriptionOrder._id}/pay`, {
      method: 'POST', token: patientToken, body: { paymentMethod: 'STRIPE' },
    });
    assert.equal(blockedPrescriptionPayment.status, 400, 'the approved prescription order cannot be paid before its seller quote');
    const revisedDelivery = expectOk(await api(`/orders/${prescriptionOrder._id}/shipping`, {
      method: 'PUT', token: parapharmacyToken, body: { shippingFee: 6.5, deliveryDays: 5 },
    }), 'seller revises shipping fee and delivery promise');
    assert.equal(revisedDelivery.finalShipping, 6.5, 'revised shipping fee is stored');
    assert.equal(revisedDelivery.promisedDeliveryDays, 5, 'revised delivery commitment is stored');
    const paidPrescriptionOrder = expectOk(await api(`/orders/${prescriptionOrder._id}/pay`, { method: 'POST', token: patientToken, body: { paymentMethod: 'STRIPE' } }), 'patient pays prescription order');
    assert.equal(paidPrescriptionOrder.paymentStatus, 'PAID', 'approved order completes payment');
    const stockedPrescriptionProduct = expectOk(await api(`/products/${prescriptionProduct._id}`), 'product after paid prescription order');
    assert.equal(stockedPrescriptionProduct.variants[0].stock, 10, 'payment atomically reduces only the selected variant stock');

    // Every supported business role receives one durable admin conversation.
    // The Admin inbox sees each role, messages are delivered both directions,
    // and unread status belongs only to the receiving account.
    const pharmacySupport = expectOk(await api('/chat/admin-support/conversation', { method: 'POST', token: pharmacyToken }), 'pharmacy opens Admin support chat');
    const reusedPharmacySupport = expectOk(await api('/chat/admin-support/conversation', { method: 'POST', token: pharmacyToken }), 'pharmacy reopens Admin support chat');
    assert.equal(reusedPharmacySupport._id, pharmacySupport._id, 'pharmacy support chat is canonical');
    expectOk(await api(`/chat/admin-support/conversations/${pharmacySupport._id}/messages`, {
      method: 'POST', token: pharmacyToken, body: { message: 'I need help with a product.' },
    }), 'pharmacy sends Admin support message');
    const chatUploadForm = new FormData();
    chatUploadForm.append('file', new Blob(['workflow admin support attachment'], { type: 'application/pdf' }), 'workflow-support.pdf');
    const uploadedChatFile = expectOk(await multipartApi('/upload/chat', { token: pharmacyToken, formData: chatUploadForm }), 'pharmacy uploads Admin support attachment');
    expectOk(await api(`/chat/admin-support/conversations/${pharmacySupport._id}/messages`, {
      method: 'POST', token: pharmacyToken,
      body: { attachments: [{ type: 'file', url: uploadedChatFile.url, name: 'workflow-support.pdf', size: 128, mimeType: 'application/pdf' }] },
    }), 'pharmacy sends Admin support attachment');
    const parapharmacySupport = expectOk(await api('/chat/admin-support/conversation', { method: 'POST', token: parapharmacyToken }), 'parapharmacy opens Admin support chat');
    const doctorSupport = expectOk(await api('/chat/admin-support/conversation', { method: 'POST', token: doctorToken }), 'doctor opens Admin support chat');
    const adminInbox = expectOk(await api('/chat/conversations', { token: adminToken }), 'Admin lists all support conversations');
    assert.equal(
      ['ADMIN_PHARMACY', 'ADMIN_PARAPHARMACY', 'ADMIN_DOCTOR'].every((type) => adminInbox.conversations.some((conversation) => conversation.conversationType === type)),
      true,
      'Admin inbox includes pharmacy, parapharmacy and doctor conversations'
    );
    const adminUnread = expectOk(await api('/chat/unread-count', { token: adminToken }), 'Admin unread support count');
    assert.equal(adminUnread.unreadCount >= 1, true, 'Admin receives an unread message from pharmacy');
    expectOk(await api(`/chat/admin-support/conversations/${pharmacySupport._id}/messages`, {
      method: 'POST', token: adminToken, body: { message: 'Your request is being reviewed.' },
    }), 'Admin replies to pharmacy support chat');
    const pharmacySupportHistory = expectOk(await api(`/chat/messages/${pharmacySupport._id}`, { token: pharmacyToken }), 'pharmacy reads Admin support history');
    assert.equal(pharmacySupportHistory.messages.length, 3, 'both support messages and the attachment remain accessible as history');
    const savedSupportAttachment = pharmacySupportHistory.messages.at(1).attachments?.[0];
    assert.equal(savedSupportAttachment?.url, uploadedChatFile.url, 'Admin support attachment retains its uploaded URL');
    assert.equal(savedSupportAttachment?.name, 'workflow-support.pdf', 'Admin support attachment retains its file name');
    assert.equal(savedSupportAttachment?.mimeType, 'application/pdf', 'Admin support attachment retains its MIME type');
    const storedChatFile = path.join(process.cwd(), uploadedChatFile.url.replace(/^\/uploads\//, 'uploads/'));
    assert.equal(fs.existsSync(storedChatFile), true, 'chat attachment is stored by the backend');
    fs.unlinkSync(storedChatFile);
    expectOk(await api(`/chat/conversations/${pharmacySupport._id}/read`, { method: 'PUT', token: pharmacyToken }), 'pharmacy marks Admin reply as read');
    assert.equal(parapharmacySupport.conversationType, 'ADMIN_PARAPHARMACY');
    assert.equal(doctorSupport.conversationType, 'ADMIN_DOCTOR');

    // Patient support tickets are a separate, private workflow rather than a
    // generic chat. Both parties receive the exact same threaded history,
    // unread state is cleared only by the recipient, and lifecycle rules
    // prevent messages on resolved or closed tickets until reopened.
    const supportTicket = expectOk(await api('/support-tickets', {
      method: 'POST', token: patientToken,
      body: {
        subject: 'Video consultation help', category: 'VIDEO_CALL', priority: 'HIGH',
        description: 'I need help joining my confirmed consultation.',
        relatedRecord: { type: 'APPOINTMENT', recordId: appointment._id.toString() },
      },
    }), 'patient creates support ticket');
    assert.equal(supportTicket.messages.length, 1, 'ticket begins with the patient request in its history');
    assert.equal(supportTicket.relatedRecord.type, 'APPOINTMENT', 'the selected related-record type is retained');
    assert.equal(String(supportTicket.relatedRecord.recordId), String(appointment._id), 'the exact selected appointment is retained on the ticket');
    const supportUnread = expectOk(await api('/support-tickets/admin/unread-count', { token: adminToken }), 'Admin ticket unread count');
    assert.equal(supportUnread.unreadCount, 1, 'new ticket increments only the Admin ticket indicator');
    const adminTicket = expectOk(await api(`/support-tickets/admin/${supportTicket._id}`, { token: adminToken }), 'Admin opens patient support ticket');
    assert.equal(adminTicket.unreadForAdmin, false, 'opening ticket marks it read for Admin');
    const patientUnreadBeforeReply = expectOk(await api('/support-tickets/unread-count', { token: patientToken }), 'patient ticket unread count before reply');
    assert.equal(patientUnreadBeforeReply.unreadCount, 0, 'patient has no unread reply before Admin responds');
    expectOk(await api(`/support-tickets/admin/${supportTicket._id}/messages`, {
      method: 'POST', token: adminToken, body: { body: 'We are checking your consultation access now.' },
    }), 'Admin replies to patient support ticket');
    const patientUnreadAfterReply = expectOk(await api('/support-tickets/unread-count', { token: patientToken }), 'patient unread ticket after Admin reply');
    assert.equal(patientUnreadAfterReply.unreadCount, 1, 'Admin reply increments the patient ticket indicator');
    const patientTicket = expectOk(await api(`/support-tickets/${supportTicket._id}`, { token: patientToken }), 'patient opens support ticket reply');
    assert.equal(patientTicket.status, 'WAITING_FOR_PATIENT', 'Admin reply moves ticket to waiting for patient');
    assert.equal(patientTicket.unreadForPatient, false, 'patient reading ticket clears only their unread state');
    expectOk(await api(`/support-tickets/${supportTicket._id}/messages`, {
      method: 'POST', token: patientToken, body: { body: 'Thank you, please let me know when it is fixed.' },
    }), 'patient replies to ticket');
    const ticketAfterPatientReply = expectOk(await api(`/support-tickets/admin/${supportTicket._id}`, { token: adminToken }), 'Admin sees patient follow-up');
    assert.equal(ticketAfterPatientReply.status, 'IN_PROGRESS', 'patient reply resumes an in-progress ticket');
    expectOk(await api(`/support-tickets/admin/${supportTicket._id}`, { method: 'PATCH', token: adminToken, body: { status: 'RESOLVED' } }), 'Admin resolves support ticket');
    const blockedResolvedReply = await api(`/support-tickets/${supportTicket._id}/messages`, { method: 'POST', token: patientToken, body: { body: 'This must be blocked while resolved.' } });
    assert.equal(blockedResolvedReply.status, 400, 'resolved ticket cannot receive messages before reopening');
    expectOk(await api(`/support-tickets/${supportTicket._id}/reopen`, { method: 'POST', token: patientToken }), 'patient reopens resolved ticket');
    expectOk(await api(`/support-tickets/admin/${supportTicket._id}`, { method: 'PATCH', token: adminToken, body: { status: 'CLOSED' } }), 'Admin closes support ticket');
    const blockedClosedReply = await api(`/support-tickets/${supportTicket._id}/messages`, { method: 'POST', token: patientToken, body: { body: 'This must be blocked after close.' } });
    assert.equal(blockedClosedReply.status, 400, 'closed ticket cannot receive additional messages');

    // Contact Us is a public inquiry form, while the displayed contact details
    // and internal inquiry workflow are persisted and owned by Admin.
    const initialContactDetails = expectOk(await api('/footer-options'), 'public contact details load');
    assert.equal(typeof initialContactDetails.address, 'string', 'public Contact Us page receives backend-managed fields');
    const configuredContactDetails = expectOk(await api('/footer-options', {
      method: 'PUT', token: adminToken,
      body: { address: '20 Care Square, Berlin', phoneNumber: '+49 30 555 0199', supportEmail: 'support@workflow.example' },
    }), 'Admin configures public contact details');
    assert.equal(configuredContactDetails.supportEmail, 'support@workflow.example', 'Admin email is saved for the public page');
    const publicContactDetails = expectOk(await api('/footer-options'), 'public contact details refresh');
    assert.equal(publicContactDetails.phoneNumber, '+49 30 555 0199', 'public contact details reflect the Admin update');
    const contactInquiry = expectOk(await api('/contact-queries', {
      method: 'POST',
      body: { name: 'Contact Visitor', email: 'visitor@workflow.example', phone: '+49 30 555 0102', services: 'Appointments', message: 'Please help me understand how an online appointment works.' },
    }), 'visitor submits Contact Us inquiry');
    const contactInquiries = expectOk(await api('/contact-queries?status=NEW', { token: adminToken }), 'Admin lists new contact inquiries');
    assert.equal(contactInquiries.queries.some((item) => String(item._id) === String(contactInquiry._id)), true, 'Admin receives the public inquiry');
    const resolvedInquiry = expectOk(await api(`/contact-queries/${contactInquiry._id}`, { method: 'PATCH', token: adminToken, body: { status: 'RESOLVED', adminNotes: 'Sent appointment guidance.' } }), 'Admin resolves contact inquiry');
    assert.equal(resolvedInquiry.status, 'RESOLVED', 'contact inquiry retains its Admin status update');

    console.log('PASS: appointment/video, canonical chat, onboarding, rich variants, prescription approval, checkout/shipping, Admin support attachments, contact inquiries, and patient support-ticket workflows');
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
