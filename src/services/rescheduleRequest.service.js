const RescheduleRequest = require('../models/rescheduleRequest.model');
const Appointment = require('../models/appointment.model');
const VideoSession = require('../models/videoSession.model');
const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');
const notificationService = require('./notification.service');
const appointmentService = require('./appointment.service');
const paymentService = require('./payment.service');
const config = require('../config/env');

/**
 * Check if patient joined the video call
 * @param {string} appointmentId - Appointment ID
 * @param {string} patientId - Patient ID
 * @returns {Promise<boolean>} True if patient joined, false otherwise
 */
const didPatientJoinVideoCall = async (appointmentId, patientId) => {
  const session = await VideoSession.findOne({
    appointmentId: appointmentId,
    patientId: patientId,
    startedAt: { $exists: true, $ne: null }
  });
  
  return !!session;
};

/**
 * Get appointments eligible for reschedule
 * @param {string} patientId - Patient ID
 * @returns {Promise<Array>} List of eligible appointments
 */
const getEligibleAppointmentsForReschedule = async (patientId) => {
  const now = new Date();
  
  // Find confirmed appointments that have passed
  const appointments = await Appointment.find({
    patientId: patientId,
    status: 'CONFIRMED',
    bookingType: 'ONLINE', // Only online appointments
    paymentStatus: 'PAID'
  })
  .populate('doctorId', 'fullName email profileImage')
  .populate('patientId', 'fullName email')
  .sort({ appointmentDate: -1, appointmentTime: -1 });
  
  if (appointments.length === 0) {
    return [];
  }
  
  // Filter appointments that have passed (date and time)
  const passedAppointments = appointments.filter(apt => {
    const appointmentDate = new Date(apt.appointmentDate);
    const [hours, minutes] = (apt.appointmentTime || '00:00').split(':').map(Number);
    appointmentDate.setHours(hours, minutes, 0, 0);
    return appointmentDate < now;
  });
  
  if (passedAppointments.length === 0) {
    return [];
  }
  
  // Filter out appointments where patient joined video call
  const appointmentIds = passedAppointments.map(apt => apt._id);
  const sessionsWithPatient = await VideoSession.find({
    patientId: patientId,
    appointmentId: { $in: appointmentIds },
    startedAt: { $exists: true, $ne: null }
  });
  
  const appointmentsWithVideo = new Set(
    sessionsWithPatient.map(session => session.appointmentId.toString())
  );
  
  // Filter out appointments with existing active requests
  const activeRequests = await RescheduleRequest.find({
    appointmentId: { $in: appointmentIds },
    status: { $in: ['PENDING', 'APPROVED'] }
  });
  
  const appointmentsWithRequests = new Set(
    activeRequests.map(req => req.appointmentId.toString())
  );
  
  // Get truly eligible appointments
  const eligibleAppointments = passedAppointments.filter(apt => {
    const aptId = apt._id.toString();
    const hasVideo = appointmentsWithVideo.has(aptId);
    const hasRequest = appointmentsWithRequests.has(aptId);
    return !hasVideo && !hasRequest;
  });
  
  return eligibleAppointments;
};

/**
 * Create reschedule request
 * @param {Object} data - Reschedule request data
 * @returns {Promise<Object>} Created reschedule request
 */
const createRescheduleRequest = async (data) => {
  const { appointmentId, patientId, reason, preferredDate, preferredTime } = data;
  
  // Get appointment
  const appointment = await Appointment.findById(appointmentId)
    .populate('doctorId', 'fullName email')
    .populate('patientId', 'fullName email');
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }
  
  // Verify patient ownership
  const patientIdStr = appointment.patientId._id ? appointment.patientId._id.toString() : appointment.patientId.toString();
  if (patientIdStr !== patientId) {
    throw new Error('Unauthorized: This appointment does not belong to you');
  }
  
  // Check eligibility
  if (appointment.status !== 'CONFIRMED') {
    throw new Error('Only confirmed appointments can be rescheduled');
  }
  
  if (appointment.paymentStatus !== 'PAID') {
    throw new Error('Only paid appointments can be rescheduled');
  }
  
  if (appointment.bookingType !== 'ONLINE') {
    throw new Error('Only online appointments can be rescheduled');
  }
  
  // Check if appointment time has passed
  const appointmentDate = new Date(appointment.appointmentDate);
  const [hours, minutes] = (appointment.appointmentTime || '00:00').split(':').map(Number);
  appointmentDate.setHours(hours, minutes, 0, 0);
  
  if (appointmentDate > new Date()) {
    throw new Error('Cannot reschedule appointment that has not yet occurred');
  }
  
  // Check if patient joined video call
  const patientJoined = await didPatientJoinVideoCall(appointmentId, patientId);
  if (patientJoined) {
    throw new Error('Cannot reschedule: You already joined the video call');
  }
  
  // Check for existing active request
  const existingRequest = await RescheduleRequest.findOne({
    appointmentId: appointmentId,
    status: { $in: ['PENDING', 'APPROVED'] }
  });
  
  if (existingRequest) {
    throw new Error('A reschedule request already exists for this appointment');
  }
  
  // Get original appointment fee
  const originalTransaction = await Transaction.findOne({
    relatedAppointmentId: appointmentId,
    status: 'SUCCESS'
  }).sort({ createdAt: -1 });
  
  if (!originalTransaction) {
    throw new Error('Original payment transaction not found');
  }
  
  // Create reschedule request
  const rescheduleRequest = await RescheduleRequest.create({
    appointmentId: appointmentId,
    originalAppointmentId: appointmentId,
    patientId: patientId,
    doctorId: appointment.doctorId._id || appointment.doctorId,
    reason: reason.trim(),
    preferredDate: preferredDate ? new Date(preferredDate) : null,
    preferredTime: preferredTime || null,
    status: 'PENDING',
    originalAppointmentFee: originalTransaction.amount
  });
  
  // Send notification to doctor
  const doctorId = appointment.doctorId._id ? appointment.doctorId._id.toString() : appointment.doctorId.toString();
  await notificationService.createNotification({
    userId: doctorId,
    title: 'New Reschedule Request',
    body: `Patient ${appointment.patientId.fullName} has requested to reschedule appointment scheduled for ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.appointmentTime}`,
    type: 'RESCHEDULE_REQUEST',
    data: {
      rescheduleRequestId: rescheduleRequest._id.toString(),
      appointmentId: appointmentId
    }
  });
  
  return rescheduleRequest;
};

/**
 * Approve reschedule request
 * @param {string} requestId - Reschedule request ID
 * @param {string} doctorId - Doctor ID
 * @param {Object} approvalData - Approval data
 * @returns {Promise<Object>} Updated request and new appointment
 */
const approveRescheduleRequest = async (requestId, doctorId, approvalData) => {
  const { newAppointmentDate, newAppointmentTime, rescheduleFee, rescheduleFeePercentage, doctorNotes } = approvalData;
  
  // Get reschedule request
  const request = await RescheduleRequest.findById(requestId)
    .populate('appointmentId')
    .populate('doctorId', 'fullName email')
    .populate('patientId', 'fullName email');
  
  if (!request) {
    throw new Error('Reschedule request not found');
  }
  
  // Verify doctor ownership
  const doctorIdStr = request.doctorId._id ? request.doctorId._id.toString() : request.doctorId.toString();
  if (doctorIdStr !== doctorId) {
    throw new Error('Unauthorized: This request does not belong to you');
  }
  
  if (request.status !== 'PENDING') {
    throw new Error(`Cannot approve request with status: ${request.status}`);
  }
  
  // Validate new date/time is in the future
  const newDateTime = new Date(newAppointmentDate);
  const [hours, minutes] = newAppointmentTime.split(':').map(Number);
  newDateTime.setHours(hours, minutes, 0, 0);
  
  if (newDateTime <= new Date()) {
    throw new Error('New appointment date/time must be in the future');
  }
  
  // Calculate reschedule fee
  const originalFee = request.originalAppointmentFee;
  let calculatedFee;
  
  if (rescheduleFeePercentage !== undefined && rescheduleFeePercentage !== null) {
    calculatedFee = (originalFee * rescheduleFeePercentage) / 100;
  } else if (rescheduleFee !== undefined && rescheduleFee !== null) {
    calculatedFee = rescheduleFee;
  } else {
    // Default 50%
    calculatedFee = originalFee * 0.5;
  }
  
  // Apply minimum fee (from config, default $5)
  const MIN_FEE = config.RESCHEDULE_MIN_FEE || 5;
  calculatedFee = Math.max(calculatedFee, MIN_FEE);
  
  // Ensure it doesn't exceed original fee
  calculatedFee = Math.min(calculatedFee, originalFee);
  
  // Get original appointment
  const originalAppointment = request.appointmentId;
  
  // Check for double-booking
  const appointmentDateStart = new Date(newAppointmentDate);
  appointmentDateStart.setHours(0, 0, 0, 0);
  const appointmentDateEnd = new Date(newAppointmentDate);
  appointmentDateEnd.setHours(23, 59, 59, 999);
  
  const existingAppointment = await Appointment.findOne({
    doctorId: originalAppointment.doctorId._id || originalAppointment.doctorId,
    appointmentDate: {
      $gte: appointmentDateStart,
      $lt: appointmentDateEnd
    },
    appointmentTime: newAppointmentTime,
    status: { $in: ['PENDING', 'CONFIRMED', 'PENDING_PAYMENT'] }
  });
  
  if (existingAppointment) {
    throw new Error('Doctor is already booked at the selected time');
  }
  
  // Create new appointment
  const newAppointment = await appointmentService.createAppointment({
    doctorId: originalAppointment.doctorId._id || originalAppointment.doctorId,
    patientId: originalAppointment.patientId._id || originalAppointment.patientId,
    appointmentDate: newAppointmentDate,
    appointmentTime: newAppointmentTime,
    appointmentDuration: originalAppointment.appointmentDuration,
    bookingType: 'ONLINE',
    patientNotes: `Rescheduled from appointment ${originalAppointment.appointmentNumber || 'N/A'}. Original appointment: ${new Date(originalAppointment.appointmentDate).toLocaleDateString()} at ${originalAppointment.appointmentTime}`,
    timezone: originalAppointment.timezone,
    timezoneOffset: originalAppointment.timezoneOffset,
    status: 'PENDING_PAYMENT', // Requires payment
    isRescheduled: true,
    originalAppointmentId: originalAppointment._id,
    rescheduleFee: calculatedFee,
    rescheduleRequestId: request._id
  });
  
  // Update original appointment
  originalAppointment.status = 'RESCHEDULED';
  originalAppointment.rescheduleRequestId = request._id;
  await originalAppointment.save();
  
  // Update reschedule request
  request.status = 'APPROVED';
  request.newAppointmentId = newAppointment._id;
  request.rescheduleFee = calculatedFee;
  request.rescheduleFeePercentage = rescheduleFeePercentage || 50;
  request.doctorNotes = doctorNotes || null;
  request.respondedAt = new Date();
  await request.save();
  
  // Send notification to patient
  const patientId = request.patientId._id ? request.patientId._id.toString() : request.patientId.toString();
  await notificationService.createNotification({
    userId: patientId,
    title: 'Reschedule Request Approved',
    body: `Your reschedule request has been approved. Please pay $${calculatedFee.toFixed(2)} to confirm your new appointment on ${new Date(newAppointmentDate).toLocaleDateString()} at ${newAppointmentTime}`,
    type: 'RESCHEDULE_APPROVED',
    data: {
      rescheduleRequestId: request._id.toString(),
      newAppointmentId: newAppointment._id.toString()
    }
  });
  
  return {
    rescheduleRequest: request,
    newAppointment: newAppointment
  };
};

/**
 * Reject reschedule request
 * @param {string} requestId - Reschedule request ID
 * @param {string} doctorId - Doctor ID
 * @param {string} rejectionReason - Rejection reason
 * @returns {Promise<Object>} Updated request
 */
const rejectRescheduleRequest = async (requestId, doctorId, rejectionReason) => {
  const request = await RescheduleRequest.findById(requestId)
    .populate('appointmentId')
    .populate('doctorId', 'fullName email')
    .populate('patientId', 'fullName email');
  
  if (!request) {
    throw new Error('Reschedule request not found');
  }
  
  // Verify doctor ownership
  const doctorIdStr = request.doctorId._id ? request.doctorId._id.toString() : request.doctorId.toString();
  if (doctorIdStr !== doctorId) {
    throw new Error('Unauthorized: This request does not belong to you');
  }
  
  if (request.status !== 'PENDING') {
    throw new Error(`Cannot reject request with status: ${request.status}`);
  }
  
  // Update request
  request.status = 'REJECTED';
  request.rejectionReason = rejectionReason.trim();
  request.respondedAt = new Date();
  await request.save();
  
  // Send notification to patient
  const patientId = request.patientId._id ? request.patientId._id.toString() : request.patientId.toString();
  await notificationService.createNotification({
    userId: patientId,
    title: 'Reschedule Request Rejected',
    body: `Your reschedule request has been rejected. Reason: ${rejectionReason}`,
    type: 'RESCHEDULE_REJECTED',
    data: {
      rescheduleRequestId: request._id.toString(),
      appointmentId: request.appointmentId._id.toString()
    }
  });
  
  return request;
};

/**
 * Process reschedule fee payment
 * @param {string} requestId - Reschedule request ID
 * @param {string} patientId - Patient ID
 * @param {string} paymentMethod - Payment method
 * @returns {Promise<Object>} Transaction and updated appointment
 */
const processReschedulePayment = async (requestId, patientId, paymentMethod = 'DUMMY') => {
  const request = await RescheduleRequest.findById(requestId)
    .populate('newAppointmentId')
    .populate('patientId', 'fullName email');
  
  if (!request) {
    throw new Error('Reschedule request not found');
  }
  
  // Verify patient ownership
  const patientIdStr = request.patientId._id ? request.patientId._id.toString() : request.patientId.toString();
  if (patientIdStr !== patientId) {
    throw new Error('Unauthorized: This request does not belong to you');
  }
  
  if (request.status !== 'APPROVED') {
    throw new Error(`Cannot pay for request with status: ${request.status}`);
  }
  
  if (!request.newAppointmentId) {
    throw new Error('New appointment not found. Please contact support.');
  }
  
  const newAppointment = request.newAppointmentId;
  
  if (newAppointment.paymentStatus === 'PAID') {
    throw new Error('Reschedule fee has already been paid');
  }
  
  // Process payment
  const transaction = await paymentService.processAppointmentPayment(
    patientId,
    newAppointment._id.toString(),
    request.rescheduleFee,
    paymentMethod
  );
  
  // Update reschedule request
  request.paymentTransactionId = transaction._id;
  await request.save();
  
  // Update new appointment
  newAppointment.status = 'CONFIRMED';
  newAppointment.paymentStatus = 'PAID';
  await newAppointment.save();
  
  // Send notifications
  await notificationService.createNotification({
    userId: patientId,
    title: 'Reschedule Payment Successful',
    body: `Your reschedule fee has been paid. Your new appointment is confirmed for ${new Date(newAppointment.appointmentDate).toLocaleDateString()} at ${newAppointment.appointmentTime}`,
    type: 'APPOINTMENT',
    data: {
      appointmentId: newAppointment._id.toString()
    }
  });
  
  // Notify doctor
  const appointment = await Appointment.findById(newAppointment._id)
    .populate('doctorId', '_id');
  
  const doctorId = appointment.doctorId._id ? appointment.doctorId._id.toString() : appointment.doctorId.toString();
  await notificationService.createNotification({
    userId: doctorId,
    title: 'Rescheduled Appointment Confirmed',
    body: `Patient has paid the reschedule fee. New appointment confirmed for ${new Date(newAppointment.appointmentDate).toLocaleDateString()} at ${newAppointment.appointmentTime}`,
    type: 'APPOINTMENT',
    data: {
      appointmentId: newAppointment._id.toString()
    }
  });
  
  return {
    transaction: transaction,
    appointment: newAppointment
  };
};

/**
 * List reschedule requests (filtered by role)
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>} List of reschedule requests
 */
const listRescheduleRequests = async (userId, userRole, filters = {}) => {
  const query = {};
  
  if (userRole === 'PATIENT') {
    query.patientId = userId;
  } else if (userRole === 'DOCTOR') {
    query.doctorId = userId;
  }
  // Admin can see all (no filter)
  
  if (filters.status) {
    query.status = filters.status.toUpperCase();
  }
  
  const requests = await RescheduleRequest.find(query)
    .populate('appointmentId', 'appointmentDate appointmentTime appointmentNumber status')
    .populate('originalAppointmentId', 'appointmentDate appointmentTime appointmentNumber')
    .populate('newAppointmentId', 'appointmentDate appointmentTime appointmentNumber status paymentStatus')
    .populate('patientId', 'fullName email profileImage')
    .populate('doctorId', 'fullName email profileImage')
    .sort({ createdAt: -1 });
  
  return requests;
};

/**
 * Get reschedule request by ID
 * @param {string} requestId - Reschedule request ID
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Reschedule request
 */
const getRescheduleRequestById = async (requestId, userId, userRole) => {
  const request = await RescheduleRequest.findById(requestId)
    .populate('appointmentId')
    .populate('originalAppointmentId')
    .populate('newAppointmentId')
    .populate('patientId', 'fullName email profileImage')
    .populate('doctorId', 'fullName email profileImage');
  
  if (!request) {
    throw new Error('Reschedule request not found');
  }
  
  // Verify access
  if (userRole === 'PATIENT') {
    const patientId = request.patientId._id ? request.patientId._id.toString() : request.patientId.toString();
    if (patientId !== userId) {
      throw new Error('Unauthorized');
    }
  } else if (userRole === 'DOCTOR') {
    const doctorId = request.doctorId._id ? request.doctorId._id.toString() : request.doctorId.toString();
    if (doctorId !== userId) {
      throw new Error('Unauthorized');
    }
  }
  // Admin can access any request
  
  return request;
};

module.exports = {
  createRescheduleRequest,
  approveRescheduleRequest,
  rejectRescheduleRequest,
  processReschedulePayment,
  listRescheduleRequests,
  getRescheduleRequestById,
  getEligibleAppointmentsForReschedule,
  didPatientJoinVideoCall
};
