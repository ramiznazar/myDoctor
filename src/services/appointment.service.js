const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const balanceService = require('./balance.service');

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
    timezoneOffset
  } = data;

  // Verify doctor and patient exist
  const [doctor, patient] = await Promise.all([
    User.findById(doctorId).populate('doctorProfile'),
    User.findById(patientId)
  ]);

  if (!doctor || doctor.role !== 'DOCTOR') {
    throw new Error('Doctor not found');
  }

  if (!patient || patient.role !== 'PATIENT') {
    throw new Error('Patient not found');
  }

  // Check if doctor is approved
  if (doctor.status !== 'APPROVED') {
    throw new Error('Doctor account is not approved. Please select an approved doctor.');
  }

  // Check if doctor has active subscription
  const hasActiveSubscription = doctor.subscriptionPlan && 
                                doctor.subscriptionExpiresAt && 
                                new Date(doctor.subscriptionExpiresAt) > new Date();
  if (!hasActiveSubscription) {
    throw new Error('Doctor does not have an active subscription. Please select another doctor.');
  }

  // Check if doctor profile is completed
  if (doctor.doctorProfile && !doctor.doctorProfile.profileCompleted) {
    throw new Error('Doctor profile is incomplete. Please select another doctor.');
  }

  // Check for double-booking (same doctor at same date/time)
  const appointmentDateTime = new Date(appointmentDate);
  const existingAppointment = await Appointment.findOne({
    doctorId,
    appointmentDate: {
      $gte: new Date(appointmentDateTime.setHours(0, 0, 0, 0)),
      $lt: new Date(appointmentDateTime.setHours(23, 59, 59, 999))
    },
    appointmentTime,
    status: { $in: ['PENDING', 'CONFIRMED'] }
  });

  if (existingAppointment) {
    throw new Error('Doctor is already booked at this time');
  }

  // Generate appointment number
  const appointmentNumber = `APT-${Date.now()}`;

  // Get appointment duration from doctor's weekly schedule or use provided/default
  let duration = appointmentDuration || 30; // Default 30 minutes
  if (!appointmentDuration) {
    const WeeklySchedule = require('../models/weeklySchedule.model');
    const weeklySchedule = await WeeklySchedule.findOne({ doctorId });
    if (weeklySchedule && weeklySchedule.appointmentDuration) {
      duration = weeklySchedule.appointmentDuration;
    }
  }

  // Calculate appointment end time - parse date correctly to avoid timezone issues
  // CRITICAL: Store date as local midnight to preserve the intended date
  // Extract date components from appointmentDate (could be string or Date)
  let year, month, day;
  if (appointmentDate instanceof Date) {
    // If it's already a Date, extract local date components
    year = appointmentDate.getFullYear();
    month = appointmentDate.getMonth();
    day = appointmentDate.getDate();
  } else {
    // Parse date string (YYYY-MM-DD format) - extract components directly
    const dateStr = appointmentDate.toString();
    let dateOnly;
    if (dateStr.includes('T')) {
      dateOnly = dateStr.split('T')[0];
    } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dateOnly = dateStr;
    } else {
      // Fallback: try to parse as Date and get local components
      const dateObj = new Date(appointmentDate);
      year = dateObj.getFullYear();
      month = dateObj.getMonth();
      day = dateObj.getDate();
      dateOnly = null; // Skip the split below
    }
    
    if (dateOnly) {
      [year, month, day] = dateOnly.split('-').map(Number);
      month = month - 1; // JavaScript months are 0-indexed
    }
  }
  
  // CRITICAL: Create date at LOCAL midnight (not UTC) to preserve the intended date
  // This ensures that when stored in MongoDB (as UTC), it represents the correct local date
  const localMidnightDate = new Date(year, month, day, 0, 0, 0, 0);
  
  const [hours, minutes] = appointmentTime.split(':').map(Number);
  // Create datetime using local timezone constructor
  const appointmentStartDateTime = new Date(year, month, day, hours, minutes, 0, 0);
  const appointmentEndDateTime = new Date(appointmentStartDateTime.getTime() + duration * 60 * 1000);
  const appointmentEndTime = `${appointmentEndDateTime.getHours().toString().padStart(2, '0')}:${appointmentEndDateTime.getMinutes().toString().padStart(2, '0')}`;

  // Generate video call link if online booking
  let videoCallLink = null;
  if (bookingType === 'ONLINE') {
    videoCallLink = `https://videocall.mydoctor.com/${appointmentNumber}`;
  }

  // Calculate timezone offset if not provided (in minutes)
  let tzOffset = timezoneOffset;
  if (!tzOffset && timezone) {
    // Try to extract offset from timezone string (e.g., "UTC+5" -> 300 minutes)
    const tzMatch = timezone.match(/UTC([+-])(\d+)/);
    if (tzMatch) {
      const sign = tzMatch[1] === '+' ? 1 : -1;
      const hours = parseInt(tzMatch[2], 10);
      tzOffset = sign * hours * 60;
    }
  }
  
  // If still no offset, try to get from current date (fallback)
  if (!tzOffset) {
    const testDate = new Date();
    tzOffset = -testDate.getTimezoneOffset(); // JavaScript offset is opposite of standard
  }
  
  // Store the date as local midnight - this preserves the intended date regardless of timezone
  const appointment = await Appointment.create({
    doctorId,
    patientId,
    appointmentDate: localMidnightDate, // Store as local midnight, not UTC
    appointmentTime,
    appointmentDuration: duration,
    appointmentEndTime,
    timezone: timezone || null,
    timezoneOffset: tzOffset || null,
    bookingType: bookingType || 'VISIT',
    patientNotes,
    clinicName,
    videoCallLink,
    appointmentNumber,
    createdBy: createdBy || patientId,
    status: 'PENDING',
    paymentStatus: 'UNPAID'
  });

  // Create notifications for doctor and patient
  const notificationService = require('./notification.service');
  await Promise.all([
    notificationService.createNotification({
      userId: doctorId,
      title: 'New Appointment Request',
      body: `${patient.fullName} has requested an appointment on ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTime}`,
      type: 'APPOINTMENT',
      data: { appointmentId: appointment._id }
    }),
    notificationService.createNotification({
      userId: patientId,
      title: 'Appointment Requested',
      body: `Your appointment request with Dr. ${doctor.fullName} is pending confirmation`,
      type: 'APPOINTMENT',
      data: { appointmentId: appointment._id }
    })
  ]);

  return appointment;
};

/**
 * Update appointment status
 * @param {string} id - Appointment ID
 * @param {Object} statusData - Status update data
 * @returns {Promise<Object>} Updated appointment
 */
const updateAppointmentStatus = async (id, statusData) => {
  const appointment = await Appointment.findById(id)
    .populate('doctorId', 'fullName email')
    .populate('patientId', 'fullName email');
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  const { status, paymentStatus, paymentMethod, notes } = statusData;

  if (status) {
    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid appointment status');
    }
    appointment.status = status;
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

  const previousStatus = appointment.status;
  await appointment.save();

  // Credit doctor balance when appointment is completed and payment is PAID
  if (status === 'COMPLETED' && appointment.paymentStatus === 'PAID' && previousStatus !== 'COMPLETED') {
    try {
      // Find the transaction related to this appointment
      const transaction = await Transaction.findOne({
        relatedAppointmentId: appointment._id,
        status: 'SUCCESS'
      }).sort({ createdAt: -1 }); // Get the most recent successful transaction

      if (transaction && transaction.amount > 0) {
        // Check if balance was already credited (avoid double crediting)
        const existingCreditTransaction = await Transaction.findOne({
          userId: appointment.doctorId._id,
          'metadata.type': 'BALANCE_CREDIT',
          'metadata.transactionType': 'APPOINTMENT',
          'metadata.appointmentId': appointment._id.toString()
        });

        if (!existingCreditTransaction) {
          // Credit doctor balance
          await balanceService.creditBalance(
            appointment.doctorId._id.toString(),
            transaction.amount,
            'APPOINTMENT',
            {
              appointmentId: appointment._id.toString(),
              appointmentNumber: appointment.appointmentNumber,
              transactionId: transaction._id.toString()
            }
          );
        }
      }
    } catch (error) {
      // Log error but don't fail the status update
      console.error('Error crediting doctor balance for completed appointment:', error);
      // You might want to add a retry mechanism or notification here
    }
  }

  // Create notification for patient when doctor accepts/rejects
  if (status === 'CONFIRMED' || status === 'REJECTED') {
    const notificationService = require('./notification.service');
    const statusMessage = status === 'CONFIRMED' 
      ? `Your appointment with Dr. ${appointment.doctorId.fullName} has been confirmed`
      : `Your appointment with Dr. ${appointment.doctorId.fullName} has been rejected`;
    
    await notificationService.createNotification({
      userId: appointment.patientId._id.toString(),
      title: status === 'CONFIRMED' ? 'Appointment Confirmed' : 'Appointment Rejected',
      body: statusMessage,
      type: 'APPOINTMENT',
      data: { appointmentId: appointment._id }
    });
  }

  return appointment;
};

/**
 * Accept appointment (doctor action)
 * @param {string} appointmentId - Appointment ID
 * @param {string} doctorId - Doctor user ID
 * @returns {Promise<Object>} Updated appointment
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

  // Create notification
  const notificationService = require('./notification.service');
  const User = require('../models/user.model');
  const doctor = await User.findById(doctorId);
  const patient = await User.findById(appointment.patientId);

  await notificationService.createNotification({
    userId: appointment.patientId.toString(),
    title: 'Appointment Confirmed',
    body: `Your appointment with Dr. ${doctor.fullName} has been confirmed`,
    type: 'APPOINTMENT',
    data: { appointmentId: appointment._id }
  });

  return appointment;
};

/**
 * Reject appointment (doctor action)
 * @param {string} appointmentId - Appointment ID
 * @param {string} doctorId - Doctor user ID
 * @param {string} reason - Optional rejection reason
 * @returns {Promise<Object>} Updated appointment
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
  if (reason) {
    appointment.notes = reason;
  }
  await appointment.save();

  // Create notification
  const notificationService = require('./notification.service');
  const User = require('../models/user.model');
  const doctor = await User.findById(doctorId);
  const patient = await User.findById(appointment.patientId);

  await notificationService.createNotification({
    userId: appointment.patientId.toString(),
    title: 'Appointment Rejected',
    body: `Your appointment with Dr. ${doctor.fullName} has been rejected${reason ? ': ' + reason : ''}`,
    type: 'APPOINTMENT',
    data: { appointmentId: appointment._id }
  });

  return appointment;
};

/**
 * Cancel appointment (patient action)
 * @param {string} appointmentId - Appointment ID
 * @param {string} patientId - Patient user ID
 * @param {string} reason - Optional cancellation reason
 * @returns {Promise<Object>} Updated appointment
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

  // Check if appointment can be cancelled (not already completed or cancelled)
  if (['COMPLETED', 'CANCELLED'].includes(appointment.status)) {
    throw new Error(`Cannot cancel appointment with status: ${appointment.status}`);
  }

  // Check if appointment time has passed
  const appointmentDateTime = new Date(appointment.appointmentDate);
  const [hours, minutes] = appointment.appointmentTime.split(':');
  appointmentDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  
  if (appointmentDateTime < new Date()) {
    throw new Error('Cannot cancel appointment that has already passed');
  }

  appointment.status = 'CANCELLED';
  if (reason) {
    appointment.notes = reason;
  }
  await appointment.save();

  // Create notification for doctor
  const notificationService = require('./notification.service');
  await notificationService.createNotification({
    userId: appointment.doctorId._id.toString(),
    title: 'Appointment Cancelled',
    body: `${appointment.patientId.fullName} has cancelled their appointment${reason ? ': ' + reason : ''}`,
    type: 'APPOINTMENT',
    data: { appointmentId: appointment._id }
  });

  return appointment;
};

/**
 * List appointments with filtering
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Appointments and pagination info
 */
const listAppointments = async (filter = {}) => {
  const {
    doctorId,
    patientId,
    status,
    fromDate,
    toDate,
    page = 1,
    limit = 10
  } = filter;

  const query = {};

  if (doctorId) {
    query.doctorId = doctorId;
  }

  if (patientId) {
    query.patientId = patientId;
  }

  if (status) {
    query.status = status.toUpperCase();
  }

  if (fromDate || toDate) {
    query.appointmentDate = {};
    if (fromDate) {
      query.appointmentDate.$gte = new Date(fromDate);
    }
    if (toDate) {
      query.appointmentDate.$lte = new Date(toDate);
    }
  }

  const skip = (page - 1) * limit;

  const [appointments, total] = await Promise.all([
    Appointment.find(query)
      .populate('doctorId', 'fullName email phone profileImage')
      .populate('patientId', 'fullName email phone profileImage')
      .skip(skip)
      .limit(limit)
      .sort({ appointmentDate: -1, appointmentTime: -1 }),
    Appointment.countDocuments(query)
  ]);

  return {
    appointments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get appointment by ID
 * @param {string} id - Appointment ID
 * @returns {Promise<Object>} Appointment
 */
const getAppointment = async (id) => {
  const appointment = await Appointment.findById(id)
    .populate('doctorId', 'fullName email phone profileImage')
    .populate('patientId', 'fullName email phone profileImage')
    .populate('videoSessionId');
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  return appointment;
};

module.exports = {
  createAppointment,
  updateAppointmentStatus,
  listAppointments,
  getAppointment,
  acceptAppointment,
  rejectAppointment,
  cancelAppointment
};

