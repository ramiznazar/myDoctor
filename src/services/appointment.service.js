const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');

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
    bookingType,
    patientNotes,
    clinicName,
    createdBy
  } = data;

  // Verify doctor and patient exist
  const [doctor, patient] = await Promise.all([
    User.findById(doctorId),
    User.findById(patientId)
  ]);

  if (!doctor || doctor.role !== 'DOCTOR') {
    throw new Error('Doctor not found');
  }

  if (!patient || patient.role !== 'PATIENT') {
    throw new Error('Patient not found');
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

  // Generate video call link if online booking
  let videoCallLink = null;
  if (bookingType === 'ONLINE') {
    videoCallLink = `https://videocall.mydoctor.com/${appointmentNumber}`;
  }

  const appointment = await Appointment.create({
    doctorId,
    patientId,
    appointmentDate: new Date(appointmentDate),
    appointmentTime,
    bookingType: bookingType || 'VISIT',
    patientNotes,
    clinicName,
    videoCallLink,
    appointmentNumber,
    createdBy: createdBy || patientId,
    status: 'PENDING',
    paymentStatus: 'UNPAID'
  });

  return appointment;
};

/**
 * Update appointment status
 * @param {string} id - Appointment ID
 * @param {Object} statusData - Status update data
 * @returns {Promise<Object>} Updated appointment
 */
const updateAppointmentStatus = async (id, statusData) => {
  const appointment = await Appointment.findById(id);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  const { status, paymentStatus, paymentMethod } = statusData;

  if (status) {
    const validStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
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

  await appointment.save();

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
  getAppointment
};

