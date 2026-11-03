const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const WeeklySchedule = require('../models/weeklySchedule.model');
const { buildBookableSlots } = require('./weeklySchedule.service');
const balanceService = require('./balance.service');
const subscriptionPolicy = require('./subscriptionPolicy.service');
const {
  isIanaTimeZone,
  getTimeZoneOffsetMinutes,
  getAppointmentDateParts,
  toUtcMidnight,
  computeAppointmentWindow,
  calculateEndClock,
} = require('../utils/appointmentTime');

const ACTIVE_APPOINTMENT_STATUSES = ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED'];
const DEFAULT_CURRENCY = 'EUR';

const getId = (value) => (value?._id || value)?.toString?.() || String(value || '');
const sameId = (left, right) => getId(left) === getId(right);

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const activeSlotKeyFor = (doctorId, dateParts, appointmentTime) =>
  `doctor:${getId(doctorId)}:date:${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}:time:${appointmentTime}`;

const releasesSlot = (status) => ['CANCELLED', 'COMPLETED', 'NO_SHOW', 'REJECTED', 'RESCHEDULED'].includes(String(status || '').toUpperCase());

const parseUtcOffsetTimezone = (timezone) => {
  const match = String(timezone || '').match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/i);
  if (!match) return null;
  const sign = match[1] === '+' ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0));
};

const normalizeTimezone = (timezone, timezoneOffset, dateParts) => {
  const requestedOffset = Number(timezoneOffset);
  const parsedOffset = parseUtcOffsetTimezone(timezone);

  if (isIanaTimeZone(timezone)) {
    const noon = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, 12, 0, 0, 0));
    const fallbackOffset = getTimeZoneOffsetMinutes(noon, timezone);
    return {
      timezone,
      timezoneOffset: Number.isFinite(requestedOffset)
        ? requestedOffset
        : Number.isFinite(fallbackOffset)
          ? fallbackOffset
          : 0,
    };
  }

  if (Number.isFinite(parsedOffset)) {
    return {
      timezone: timezone || null,
      timezoneOffset: Number.isFinite(requestedOffset) ? requestedOffset : parsedOffset,
    };
  }

  return {
    timezone: null,
    timezoneOffset: Number.isFinite(requestedOffset) ? requestedOffset : 0,
  };
};

const resolvePricing = (doctor, bookingType, requestedServices = []) => {
  const profile = doctor?.doctorProfile || doctor?.profile || null;
  const configuredFee = bookingType === 'ONLINE'
    ? profile?.consultationFees?.online
    : profile?.consultationFees?.clinic;
  const parsedFee = configuredFee === null || configuredFee === undefined || configuredFee === ''
    ? NaN
    : Number(configuredFee);
  const consultationFee = Number.isFinite(parsedFee) && parsedFee >= 0 ? roundMoney(parsedFee) : 0;

  const availableServices = Array.isArray(profile?.services) ? profile.services : [];
  const requested = Array.isArray(requestedServices) ? requestedServices : [];
  const normalizedNames = requested
    .map((service) => {
      if (typeof service === 'string') return service.trim();
      if (service && typeof service === 'object') return String(service.name || '').trim();
      return '';
    })
    .filter(Boolean);

  const selectedServices = [];
  for (const name of [...new Set(normalizedNames)]) {
    const match = availableServices.find((service) => String(service?.name || '').trim().toLowerCase() === name.toLowerCase());
    if (!match) {
      const error = new Error(`Service "${name}" is not offered by this doctor`);
      error.statusCode = 400;
      throw error;
    }
    const price = Number(match.price);
    selectedServices.push({
      name: match.name,
      price: Number.isFinite(price) && price >= 0 ? roundMoney(price) : 0,
    });
  }

  const servicesTotal = selectedServices.reduce((total, service) => total + service.price, 0);
  return {
    consultationFee,
    selectedServices,
    servicesTotal: roundMoney(servicesTotal),
    totalAmount: roundMoney(consultationFee + servicesTotal),
    currency: DEFAULT_CURRENCY,
  };
};

/**
 * Build the authoritative price breakdown used by checkout.
 * Client supplied amounts are never trusted.
 */
const getBookingQuote = async ({ doctorId, bookingType = 'VISIT', selectedServices = [] }) => {
  if (!doctorId) {
    const error = new Error('Doctor ID is required');
    error.statusCode = 400;
    throw error;
  }

  const doctor = await User.findById(doctorId).populate('doctorProfile');
  if (!doctor || doctor.role !== 'DOCTOR') {
    const error = new Error('Doctor not found');
    error.statusCode = 404;
    throw error;
  }

  if (!['VISIT', 'ONLINE'].includes(bookingType)) {
    const error = new Error('Invalid booking type');
    error.statusCode = 400;
    throw error;
  }

  const weeklySchedule = await WeeklySchedule.findOne({ doctorId });
  const pricing = resolvePricing(doctor, bookingType, selectedServices);

  return {
    doctorId: getId(doctor._id),
    doctorName: doctor.fullName || doctor.email || 'Doctor',
    bookingType,
    appointmentDuration: weeklySchedule?.appointmentDuration || 30,
    ...pricing,
  };
};

/**
 * Create appointment
 * @param {Object} data - Appointment data
 * @returns {Promise<Object>} Created appointment
 */
const createAppointment = async (data) => {
  const {
    doctorId,
    patientId,
    appointmentDate,
    appointmentTime,
    appointmentDuration,
    bookingType,
    patientNotes,
    clinicName,
    createdBy,
    timezone,
    timezoneOffset,
    selectedServices,
    status,
    isRescheduled,
    originalAppointmentId,
    rescheduleFee,
    rescheduleRequestId,
  } = data;

  const [doctor, patient] = await Promise.all([
    User.findById(doctorId).populate('doctorProfile'),
    User.findById(patientId),
  ]);

  if (!doctor || doctor.role !== 'DOCTOR') {
    throw new Error('Doctor not found');
  }

  if (!patient || patient.role !== 'PATIENT') {
    throw new Error('Patient not found');
  }

  if (doctor.status !== 'APPROVED') {
    throw new Error('Doctor account is not approved. Please select an approved doctor.');
  }

  const hasActiveSubscription = doctor.subscriptionPlan &&
    doctor.subscriptionExpiresAt &&
    new Date(doctor.subscriptionExpiresAt) > new Date();
  if (!hasActiveSubscription) {
    throw new Error('Doctor does not have an active subscription. Please select another doctor.');
  }

  await subscriptionPolicy.enforceAppointmentBookingLimit({
    doctorId,
    bookingType: bookingType || 'VISIT',
  });

  if (doctor.doctorProfile && !doctor.doctorProfile.profileCompleted) {
    throw new Error('Doctor profile is incomplete. Please select another doctor.');
  }

  const dateParts = getAppointmentDateParts(appointmentDate);
  const appointmentDateUtc = toUtcMidnight(dateParts);
  const nextDateUtc = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + 1, 0, 0, 0, 0));
  const previousDateUtc = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day - 1, 0, 0, 0, 0));

  // Validate the time before using it in conflict queries.
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(appointmentTime || ''))) {
    throw new Error('Invalid appointment time');
  }

  // The weekly schedule is the authority for both duration and the actual
  // selectable clock times. A client may only book an interval that the
  // doctor explicitly opened in the schedule editor.
  const weeklySchedule = await WeeklySchedule.findOne({ doctorId });
  const duration = Number(weeklySchedule?.appointmentDuration) || Number(appointmentDuration) || 30;
  if (!Number.isFinite(duration) || duration < 15 || duration > 480) {
    throw new Error('Invalid appointment duration');
  }

  const bookableSlots = buildBookableSlots(weeklySchedule, dateParts);
  const selectedSlot = bookableSlots.find((slot) => slot.startTime === appointmentTime && slot.duration === duration);
  if (!selectedSlot) {
    const error = new Error('The selected appointment time is no longer available. Please choose another slot.');
    error.statusCode = 409;
    throw error;
  }

  const normalizedTimezone = normalizeTimezone(timezone, timezoneOffset, dateParts);
  const appointmentEndTime = calculateEndClock(appointmentTime, duration);
  const windowProbe = {
    appointmentDate: appointmentDateUtc,
    appointmentTime,
    appointmentEndTime,
    appointmentDuration: duration,
    timezone: normalizedTimezone.timezone,
    timezoneOffset: normalizedTimezone.timezoneOffset,
  };
  const { start: requestedStart, end: requestedEnd } = computeAppointmentWindow(windowProbe);

  // Query a wide enough range to catch an overnight appointment from the
  // previous day, then compare real UTC windows instead of raw clock strings.
  const candidates = await Appointment.find({
    doctorId,
    appointmentDate: { $gte: previousDateUtc, $lt: nextDateUtc },
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
  }).select('appointmentDate appointmentTime appointmentEndTime appointmentDuration timezone timezoneOffset status');

  const conflicting = candidates.find((candidate) => {
    try {
      const { start, end } = computeAppointmentWindow(candidate);
      return requestedStart < end && requestedEnd > start;
    } catch {
      return false;
    }
  });

  if (conflicting) {
    const error = new Error('Doctor is already booked at this time');
    error.statusCode = 409;
    throw error;
  }

  const pricing = resolvePricing(doctor, bookingType || 'VISIT', selectedServices);
  const appointmentNumber = `APT-${Date.now()}`;
  const videoCallLink = bookingType === 'ONLINE'
    ? `https://videocall.mydoctor.com/${appointmentNumber}`
    : null;

  const requestedStatus = String(status || '').toUpperCase();
  const allowedInitialStatuses = ['PENDING_PAYMENT', 'PENDING', 'CONFIRMED', 'RESCHEDULED'];
  const initialStatus = allowedInitialStatuses.includes(requestedStatus) ? requestedStatus : 'PENDING_PAYMENT';

  let appointment;
  try {
    appointment = await Appointment.create({
      doctorId,
      patientId,
      appointmentDate: appointmentDateUtc,
      appointmentTime,
      appointmentDuration: duration,
      appointmentEndTime,
      activeSlotKey: activeSlotKeyFor(doctorId, dateParts, appointmentTime),
      consultationFee: pricing.consultationFee,
      selectedServices: pricing.selectedServices,
      totalAmount: pricing.totalAmount,
      currency: pricing.currency,
      timezone: normalizedTimezone.timezone,
      timezoneOffset: normalizedTimezone.timezoneOffset,
      bookingType: bookingType || 'VISIT',
      patientNotes,
      clinicName,
      videoCallLink,
      appointmentNumber,
      createdBy: createdBy || patientId,
      status: initialStatus,
      paymentStatus: 'UNPAID',
      isRescheduled: isRescheduled || false,
      originalAppointmentId: originalAppointmentId || null,
      rescheduleFee: rescheduleFee || null,
      rescheduleRequestId: rescheduleRequestId || null,
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.activeSlotKey) {
      const conflict = new Error('This appointment time was just booked. Please choose another slot.');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }

  // Notifications are best effort; a notification failure must not hide a
  // successfully stored appointment or payment.
  try {
    const notificationService = require('./notification.service');
    const dateLabel = new Date(appointmentDateUtc).toLocaleDateString();
    await Promise.all([
      notificationService.createNotification({
        userId: doctorId,
        title: 'New Appointment Request',
        body: `${patient.fullName} has requested an appointment on ${dateLabel} at ${appointmentTime}`,
        i18n: {
          title: { it: 'Nuova richiesta di appuntamento' },
          body: { it: `${patient.fullName} ha richiesto un appuntamento il ${new Date(appointmentDateUtc).toLocaleDateString('it-IT')} alle ${appointmentTime}` },
        },
        type: 'APPOINTMENT',
        data: { appointmentId: appointment._id },
      }),
      notificationService.createNotification({
        userId: patientId,
        title: 'Appointment Requested',
        body: `Your appointment request with Dr. ${doctor.fullName} is pending confirmation`,
        i18n: {
          title: { it: 'Appuntamento richiesto' },
          body: { it: `La tua richiesta di appuntamento con il Dott. ${doctor.fullName} è in attesa di conferma` },
        },
        type: 'APPOINTMENT',
        data: { appointmentId: appointment._id },
      }),
    ]);
  } catch (notificationError) {
    console.error('Failed to create appointment notifications:', notificationError);
  }

  return appointment;
};

/**
 * Update appointment status
 * @param {string} id - Appointment ID
 * @param {Object} statusData - Status update data
 * @returns {Promise<Object>} Updated appointment
 */
const updateAppointmentStatus = async (id, statusData, actor = null) => {
  const appointment = await Appointment.findById(id)
    .populate('doctorId', 'fullName email')
    .populate('patientId', 'fullName email');

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  const actorRole = String(actor?.role || '').toUpperCase();
  const actorId = getId(actor?.userId);
  if (actorRole !== 'ADMIN') {
    if (actorRole !== 'DOCTOR' || !sameId(appointment.doctorId, actorId)) {
      const error = new Error('You are not allowed to update this appointment');
      error.statusCode = 403;
      throw error;
    }
    if (!['COMPLETED', 'NO_SHOW'].includes(String(statusData.status || '').toUpperCase()) ||
        statusData.paymentStatus !== undefined || statusData.paymentMethod !== undefined) {
      const error = new Error('Doctors can only mark their confirmed appointments as completed or no-show');
      error.statusCode = 403;
      throw error;
    }
    if (appointment.status !== 'CONFIRMED') {
      throw new Error(`Cannot update an appointment with status: ${appointment.status}`);
    }
  }

  const { status, paymentStatus, paymentMethod, notes } = statusData;
  const previousStatus = appointment.status;

  if (status) {
    const validStatuses = ['PENDING', 'PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid appointment status');
    }
    appointment.status = status;
    if (releasesSlot(status)) {
      appointment.activeSlotKey = undefined;
    }
  }

  if (paymentStatus) {
    const validPaymentStatuses = ['UNPAID', 'PAID', 'REFUNDED'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      throw new Error('Invalid payment status');
    }
    appointment.paymentStatus = paymentStatus;
  }

  if (paymentMethod) {
    appointment.paymentMethod = paymentMethod;
  }

  if (notes !== undefined) {
    appointment.notes = notes;
  }

  await appointment.save();

  // Credit doctor balance when appointment is completed and payment is PAID.
  if (status === 'COMPLETED' && appointment.paymentStatus === 'PAID' && previousStatus !== 'COMPLETED') {
    try {
      const transaction = await Transaction.findOne({
        relatedAppointmentId: appointment._id,
        status: 'SUCCESS',
      }).sort({ createdAt: -1 });

      if (transaction && transaction.amount > 0) {
        const existingCreditTransaction = await Transaction.findOne({
          userId: appointment.doctorId._id,
          'metadata.type': 'BALANCE_CREDIT',
          'metadata.transactionType': 'APPOINTMENT',
          'metadata.appointmentId': appointment._id.toString(),
        });

        if (!existingCreditTransaction) {
          await balanceService.creditBalance(
            appointment.doctorId._id.toString(),
            transaction.amount,
            'APPOINTMENT',
            {
              appointmentId: appointment._id.toString(),
              appointmentNumber: appointment.appointmentNumber,
              transactionId: transaction._id.toString(),
            }
          );
        }
      }
    } catch (error) {
      console.error('Error crediting doctor balance for completed appointment:', error);
    }
  }

  if (status === 'CONFIRMED' || status === 'REJECTED') {
    const notificationService = require('./notification.service');
    const statusMessage = status === 'CONFIRMED'
      ? `Your appointment with Dr. ${appointment.doctorId.fullName} has been confirmed`
      : `Your appointment with Dr. ${appointment.doctorId.fullName} has been rejected`;

    await notificationService.createNotification({
      userId: appointment.patientId._id.toString(),
      title: status === 'CONFIRMED' ? 'Appointment Confirmed' : 'Appointment Rejected',
      body: statusMessage,
      i18n: {
        title: { it: status === 'CONFIRMED' ? 'Appuntamento confermato' : 'Appuntamento rifiutato' },
        body: {
          it: status === 'CONFIRMED'
            ? `Il tuo appuntamento con il Dott. ${appointment.doctorId.fullName} è stato confermato`
            : `Il tuo appuntamento con il Dott. ${appointment.doctorId.fullName} è stato rifiutato`,
        },
      },
      type: 'APPOINTMENT',
      data: { appointmentId: appointment._id },
    });
  }

  return appointment;
};

/**
 * Accept appointment (doctor action)
 */
const acceptAppointment = async (appointmentId, doctorId) => {
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.doctorId.toString() !== doctorId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }

  if (appointment.status !== 'PENDING') {
    throw new Error(`Cannot accept appointment with status: ${appointment.status}`);
  }

  appointment.status = 'CONFIRMED';
  await appointment.save();

  const notificationService = require('./notification.service');
  const doctor = await User.findById(doctorId);

  await notificationService.createNotification({
    userId: appointment.patientId.toString(),
    title: 'Appointment Confirmed',
    body: `Your appointment with Dr. ${doctor.fullName} has been confirmed`,
    i18n: {
      title: { it: 'Appuntamento confermato' },
      body: { it: `Il tuo appuntamento con il Dott. ${doctor.fullName} è stato confermato` },
    },
    type: 'APPOINTMENT',
    data: { appointmentId: appointment._id },
  });

  return appointment;
};

/**
 * Reject appointment (doctor action)
 */
const rejectAppointment = async (appointmentId, doctorId, reason = null) => {
  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.doctorId.toString() !== doctorId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }

  if (appointment.status !== 'PENDING') {
    throw new Error(`Cannot reject appointment with status: ${appointment.status}`);
  }

  appointment.status = 'REJECTED';
  appointment.activeSlotKey = undefined;
  if (reason) {
    appointment.notes = reason;
  }
  await appointment.save();

  const notificationService = require('./notification.service');
  const doctor = await User.findById(doctorId);

  await notificationService.createNotification({
    userId: appointment.patientId.toString(),
    title: 'Appointment Rejected',
    body: `Your appointment with Dr. ${doctor.fullName} has been rejected${reason ? ': ' + reason : ''}`,
    i18n: {
      title: { it: 'Appuntamento rifiutato' },
      body: { it: `Il tuo appuntamento con il Dott. ${doctor.fullName} è stato rifiutato${reason ? ': ' + reason : ''}` },
    },
    type: 'APPOINTMENT',
    data: { appointmentId: appointment._id },
  });

  return appointment;
};

/**
 * Cancel appointment (patient action)
 */
const cancelAppointment = async (appointmentId, patientId, reason = null) => {
  const appointment = await Appointment.findById(appointmentId)
    .populate('doctorId', 'fullName email')
    .populate('patientId', 'fullName email');

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (appointment.patientId._id.toString() !== patientId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }

  if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(appointment.status)) {
    throw new Error(`Cannot cancel appointment with status: ${appointment.status}`);
  }

  const { start } = computeAppointmentWindow(appointment);
  if (start < new Date()) {
    throw new Error('Cannot cancel appointment that has already passed');
  }

  appointment.status = 'CANCELLED';
  appointment.activeSlotKey = undefined;
  if (reason) {
    appointment.notes = reason;
  }
  await appointment.save();

  const notificationService = require('./notification.service');
  await notificationService.createNotification({
    userId: appointment.doctorId._id.toString(),
    title: 'Appointment Cancelled',
    body: `${appointment.patientId.fullName} has cancelled their appointment${reason ? ': ' + reason : ''}`,
    i18n: {
      title: { it: 'Appuntamento annullato' },
      body: { it: `${appointment.patientId.fullName} ha annullato l'appuntamento${reason ? ': ' + reason : ''}` },
    },
    type: 'APPOINTMENT',
    data: { appointmentId: appointment._id },
  });

  return appointment;
};

/**
 * List appointments with filtering
 */
const listAppointments = async (filter = {}) => {
  const {
    doctorId,
    patientId,
    status,
    fromDate,
    toDate,
    page = 1,
    limit = 10,
  } = filter;

  const query = {};

  if (doctorId) query.doctorId = doctorId;
  if (patientId) query.patientId = patientId;
  if (status) query.status = status.toUpperCase();

  if (fromDate || toDate) {
    query.appointmentDate = {};
    if (fromDate) query.appointmentDate.$gte = new Date(fromDate);
    if (toDate) query.appointmentDate.$lte = new Date(toDate);
  }

  const skip = (page - 1) * limit;

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate('doctorId', 'fullName email phone profileImage')
      .populate('patientId', 'fullName email phone profileImage')
      .skip(skip)
      .limit(limit)
      .sort({ appointmentDate: -1, appointmentTime: -1 }),
    Appointment.countDocuments(query),
  ]);

  return {
    appointments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get appointment by ID
 */
const getAppointment = async (id, actor = null) => {
  const appointment = await Appointment.findById(id)
    .populate('doctorId', 'fullName email phone profileImage')
    .populate('patientId', 'fullName email phone profileImage')
    .populate('videoSessionId');

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  const actorRole = String(actor?.role || '').toUpperCase();
  const actorId = getId(actor?.userId);
  const isParticipant = sameId(appointment.doctorId, actorId) || sameId(appointment.patientId, actorId);
  if (actorRole !== 'ADMIN' && !isParticipant) {
    const error = new Error('You do not have access to this appointment');
    error.statusCode = 403;
    throw error;
  }

  return appointment;
};

module.exports = {
  createAppointment,
  getBookingQuote,
  updateAppointmentStatus,
  listAppointments,
  getAppointment,
  acceptAppointment,
  rejectAppointment,
  cancelAppointment,
};
