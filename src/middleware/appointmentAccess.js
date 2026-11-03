const Appointment = require('../models/appointment.model');
const asyncHandler = require('./asyncHandler');
const {
  getAppointmentDateParts,
  getAppointmentStart,
  computeAppointmentWindow,
} = require('../utils/appointmentTime');

/**
 * Extract the intended calendar date components from an appointment date.
 * Kept as a named export for older callers.
 */
const parseAppointmentDate = (appointmentDate) => {
  if (!appointmentDate) return null;
  return getAppointmentDateParts(appointmentDate);
};

const getAppointmentDate = (appointmentDate, appointmentTime) => {
  const date = appointmentDate instanceof Date ? appointmentDate : new Date(appointmentDate);
  if (Number.isNaN(date.getTime())) return null;
  const [hours, minutes] = String(appointmentTime || '').split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  const result = new Date(date);
  result.setUTCHours(hours, minutes, 0, 0);
  return result;
};

/**
 * Check whether the appointment clock time has started, allowing a small
 * buffer for clock differences. Prefer passing the full appointment object so
 * its timezone can be applied.
 */
const isAppointmentTimeStarted = (appointmentOrDate, appointmentTime, bufferMinutes = 2) => {
  let start;
  if (appointmentOrDate && typeof appointmentOrDate === 'object' && appointmentOrDate.appointmentDate) {
    start = getAppointmentStart(appointmentOrDate);
  } else {
    start = getAppointmentDate(appointmentOrDate, appointmentTime);
  }
  if (!start || Number.isNaN(start.getTime())) return false;
  return new Date() >= new Date(start.getTime() - bufferMinutes * 60 * 1000);
};

/**
 * Returns whether now is inside the appointment start/end window.
 */
const isWithinAppointmentWindow = (appointment) => {
  if (!appointment || !appointment.appointmentDate || !appointment.appointmentTime) {
    return {
      isValid: false,
      message: 'Invalid appointment data',
      startTime: null,
      endTime: null,
    };
  }

  try {
    const { start, end } = computeAppointmentWindow(appointment);
    const now = new Date();
    const earliestAllowedTime = new Date(start.getTime() - 2 * 60 * 1000);

    if (now > end) {
      return {
        isValid: false,
        message: `The appointment time has passed. The appointment window was from ${start.toUTCString()} to ${end.toUTCString()}.`,
        startTime: start,
        endTime: end,
      };
    }

    if (now < earliestAllowedTime) {
      return {
        isValid: false,
        message: `Communication is only available during the scheduled appointment time window. Your appointment starts at ${start.toUTCString()} and ends at ${end.toUTCString()}.`,
        startTime: start,
        endTime: end,
      };
    }

    return { isValid: true, message: null, startTime: start, endTime: end };
  } catch (error) {
    return {
      isValid: false,
      message: error.message || 'Invalid appointment time',
      startTime: null,
      endTime: null,
    };
  }
};

const participantIds = (appointment) => ({
  doctorId: String(appointment.doctorId?._id || appointment.doctorId || ''),
  patientId: String(appointment.patientId?._id || appointment.patientId || ''),
});

const requireParticipant = async (req, res, appointment) => {
  const { doctorId, patientId } = participantIds(appointment);
  if (req.userId !== doctorId && req.userId !== patientId) {
    res.status(403).json({
      success: false,
      message: 'You do not have access to this appointment',
      errors: [],
    });
    return false;
  }
  return true;
};

/**
 * Middleware for communication features that require the appointment to be
 * confirmed and currently inside its scheduled window.
 */
const requireAppointmentAccess = asyncHandler(async (req, res, next) => {
  const appointmentId = req.body?.appointmentId || req.params?.appointmentId;
  if (!appointmentId) {
    return res.status(400).json({
      success: false,
      message: 'Appointment ID is required',
      errors: [{ field: 'appointmentId', message: 'Appointment ID is required' }],
    });
  }

  const appointment = await Appointment.findById(appointmentId)
    .populate('doctorId', 'phone address')
    .populate('patientId', 'phone address');

  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found', errors: [] });
  }

  if (!(await requireParticipant(req, res, appointment))) return;

  if (appointment.status !== 'CONFIRMED') {
    const statusMessages = {
      PENDING: 'Appointment is pending doctor acceptance. Communication will be available after the doctor accepts the appointment.',
      PENDING_PAYMENT: 'Appointment payment is pending. Communication will be available after payment and doctor confirmation.',
      REJECTED: 'This appointment was rejected. Communication is not available.',
      CANCELLED: 'This appointment was cancelled. Communication is not available.',
      COMPLETED: 'This appointment has been completed. Communication is no longer available.',
      NO_SHOW: 'This appointment was marked as no-show. Communication is not available.',
    };
    return res.status(403).json({
      success: false,
      message: statusMessages[appointment.status] || 'Communication is not available for this appointment status.',
      errors: [],
    });
  }

  const timeWindowCheck = isWithinAppointmentWindow(appointment);
  if (!timeWindowCheck.isValid) {
    return res.status(403).json({
      success: false,
      message: timeWindowCheck.message || 'Communication is only available during the scheduled appointment time window.',
      errors: [],
      appointmentDateTime: timeWindowCheck.startTime?.toISOString(),
      appointmentEndTime: timeWindowCheck.endTime?.toISOString(),
    });
  }

  req.appointment = appointment;
  next();
});

/**
 * Middleware that only verifies participation and CONFIRMED status, without
 * restricting access to the appointment time window.
 */
const requireConfirmedAppointment = asyncHandler(async (req, res, next) => {
  const appointmentId = req.body?.appointmentId || req.params?.appointmentId;
  if (!appointmentId) {
    return res.status(400).json({ success: false, message: 'Appointment ID is required', errors: [] });
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    return res.status(404).json({ success: false, message: 'Appointment not found', errors: [] });
  }

  if (!(await requireParticipant(req, res, appointment))) return;

  if (appointment.status !== 'CONFIRMED') {
    return res.status(403).json({
      success: false,
      message: 'Appointment must be confirmed before accessing communication features.',
      errors: [],
    });
  }

  req.appointment = appointment;
  next();
});

module.exports = {
  requireAppointmentAccess,
  requireConfirmedAppointment,
  isAppointmentTimeStarted,
  isWithinAppointmentWindow,
  parseAppointmentDate,
};
