const Appointment = require('../models/appointment.model');
const asyncHandler = require('./asyncHandler');

/**
 * Parse appointment date to get year, month, day components
 * Handles timezone issues by parsing date strings directly
 */
const parseAppointmentDate = (appointmentDate) => {
  if (!appointmentDate) {
    return null;
  }
  
  if (appointmentDate instanceof Date) {
    // For Date objects, use local date components
    // This is what the user expects (local date, not UTC)
    return {
      year: appointmentDate.getFullYear(),
      month: appointmentDate.getMonth(),
      day: appointmentDate.getDate()
    };
  }
  
  // For strings, parse directly to avoid timezone conversion
  const dateStr = appointmentDate.toString();
  
  // Try ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  if (dateStr.includes('T')) {
    const dateOnly = dateStr.split('T')[0];
    const [y, m, d] = dateOnly.split('-').map(Number);
    return {
      year: y,
      month: m - 1, // JavaScript months are 0-indexed
      day: d
    };
  }
  
  // Try YYYY-MM-DD format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return {
      year: y,
      month: m - 1,
      day: d
    };
  }
  
  // Fallback: parse as Date and get local components
  const dateObj = new Date(appointmentDate);
  return {
    year: dateObj.getFullYear(),
    month: dateObj.getMonth(),
    day: dateObj.getDate()
  };
};

/**
 * Helper function to check if appointment time has started
 * @param {Date} appointmentDate - Appointment date
 * @param {String} appointmentTime - Appointment time (HH:MM format)
 * @param {Number} bufferMinutes - Buffer time in minutes before appointment (default: 2 minutes)
 * @returns {boolean} True if appointment time has started (or within buffer)
 */
const isAppointmentTimeStarted = (appointmentDate, appointmentTime, bufferMinutes = 2) => {
  if (!appointmentDate || !appointmentTime) {
    return false;
  }

  // Parse appointment time (HH:MM format)
  const [hours, minutes] = appointmentTime.split(':').map(Number);
  
  // Create appointment datetime - ensure we're working with local time, not UTC
  // Convert appointmentDate to a proper Date object if it's a string
  const dateObj = appointmentDate instanceof Date ? appointmentDate : new Date(appointmentDate);
  const appointmentDateTime = new Date(dateObj);
  appointmentDateTime.setHours(hours, minutes, 0, 0);
  
  // Get current time
  const now = new Date();
  
  // Allow buffer time before appointment (e.g., 2 minutes early)
  // This accounts for clock differences and allows users to join slightly early
  const bufferTime = bufferMinutes * 60 * 1000; // Convert to milliseconds
  const earliestAllowedTime = new Date(appointmentDateTime.getTime() - bufferTime);
  
  // Debug logging
  console.log('🕐 [Time Check]', {
    now: now.toISOString(),
    appointmentDateTime: appointmentDateTime.toISOString(),
    earliestAllowedTime: earliestAllowedTime.toISOString(),
    timeDifference: now.getTime() - appointmentDateTime.getTime(),
    bufferMinutes,
    isAllowed: now >= earliestAllowedTime
  });
  
  // Check if current time is >= earliest allowed time (appointment time - buffer)
  return now >= earliestAllowedTime;
};

/**
 * Helper function to check if current time is within appointment window
 * @param {Object} appointment - Appointment object with appointmentDate, appointmentTime, appointmentEndTime, appointmentDuration
 * @returns {Object} { isValid: boolean, message: string, startTime: Date, endTime: Date }
 */
const isWithinAppointmentWindow = (appointment) => {
  if (!appointment || !appointment.appointmentDate || !appointment.appointmentTime) {
    return {
      isValid: false,
      message: 'Invalid appointment data',
      startTime: null,
      endTime: null
    };
  }

  const now = new Date();
  
  // Parse appointment date using helper function
  const dateComponents = parseAppointmentDate(appointment.appointmentDate);
  if (!dateComponents) {
    return {
      isValid: false,
      message: 'Invalid appointment date',
      startTime: null,
      endTime: null
    };
  }
  
  const { year, month, day } = dateComponents;
  
  // Parse appointment time (HH:MM format) - this is in local timezone
  const [startHours, startMinutes] = appointment.appointmentTime.split(':').map(Number);
  
  // Create appointment start datetime using local timezone constructor
  // This combines the date with local time
  const appointmentStartDateTime = new Date(year, month, day, startHours, startMinutes, 0, 0);
  
  // Calculate appointment end time
  let appointmentEndDateTime;
  if (appointment.appointmentEndTime) {
    const [endHours, endMinutes] = appointment.appointmentEndTime.split(':').map(Number);
    // Handle end time that might be on the next day (e.g., 11:55 PM appointment might end at 12:25 AM next day)
    let endYear = year;
    let endMonth = month;
    let endDay = day;
    
    // If end time is earlier than start time (e.g., 00:30 vs 23:30), it's the next day
    if (endHours < startHours || (endHours === startHours && endMinutes < startMinutes)) {
      // End time is on the next day
      const nextDay = new Date(year, month, day + 1);
      endYear = nextDay.getFullYear();
      endMonth = nextDay.getMonth();
      endDay = nextDay.getDate();
    }
    
    appointmentEndDateTime = new Date(endYear, endMonth, endDay, endHours, endMinutes, 0, 0);
  } else {
    // Calculate from duration (default 30 minutes)
    const duration = appointment.appointmentDuration || 30;
    appointmentEndDateTime = new Date(appointmentStartDateTime.getTime() + duration * 60 * 1000);
  }
  
  // Allow buffer before appointment start time to account for clock differences
  // Increased buffer to handle timezone issues - users can join anytime during the window
  const bufferTime = 15 * 60 * 1000; // 15 minutes buffer to handle timezone/clock sync issues
  const earliestAllowedTime = new Date(appointmentStartDateTime.getTime() - bufferTime);
  
  // Also allow a grace period after end time (5 minutes) in case of minor timezone issues
  const gracePeriodAfterEnd = 5 * 60 * 1000; // 5 minutes
  const latestAllowedTime = new Date(appointmentEndDateTime.getTime() + gracePeriodAfterEnd);
  
  // Debug logging to help diagnose timezone issues
  const timeDiff = now.getTime() - appointmentStartDateTime.getTime();
  const timeDiffMinutes = timeDiff / (60 * 1000);
  const isValid = now >= earliestAllowedTime && now <= appointmentEndDateTime;
  
  console.log('🕐 [Window Check]', {
    now: {
      iso: now.toISOString(),
      local: now.toString(),
      timestamp: now.getTime()
    },
    appointment: {
      dateRaw: appointment.appointmentDate,
      dateType: typeof appointment.appointmentDate,
      dateIsDate: appointment.appointmentDate instanceof Date,
      time: appointment.appointmentTime,
      endTime: appointment.appointmentEndTime,
      duration: appointment.appointmentDuration
    },
    calculated: {
      year, month, day,
      startHours, startMinutes,
      startDateTime: {
        iso: appointmentStartDateTime.toISOString(),
        local: appointmentStartDateTime.toString(),
        timestamp: appointmentStartDateTime.getTime()
      },
      endDateTime: {
        iso: appointmentEndDateTime.toISOString(),
        local: appointmentEndDateTime.toString(),
        timestamp: appointmentEndDateTime.getTime()
      },
      earliestAllowed: {
        iso: earliestAllowedTime.toISOString(),
        local: earliestAllowedTime.toString(),
        timestamp: earliestAllowedTime.getTime()
      }
    },
    comparison: {
      timeDifferenceMs: timeDiff,
      timeDifferenceMinutes: timeDiffMinutes.toFixed(2),
      isBeforeStart: now < earliestAllowedTime,
      isAfterEnd: now > latestAllowedTime,
      isValid: isValid
    }
  });
  
  // Check if current time is before earliest allowed time (appointment start - buffer)
  if (now < earliestAllowedTime) {
    console.log('❌ [Window Check] BLOCKED: Time is before earliest allowed time');
    console.log(`   Current: ${now.toString()} (${now.getTime()})`);
    console.log(`   Earliest: ${earliestAllowedTime.toString()} (${earliestAllowedTime.getTime()})`);
    console.log(`   Difference: ${timeDiffMinutes.toFixed(2)} minutes`);
    return {
      isValid: false,
      message: `Video call is only available during the scheduled appointment time window. Your appointment starts at ${appointmentStartDateTime.toLocaleString()} and ends at ${appointmentEndDateTime.toLocaleString()}.`,
      startTime: appointmentStartDateTime,
      endTime: appointmentEndDateTime
    };
  }
  
  // Check if current time is after latest allowed time (end time + grace period)
  if (now > latestAllowedTime) {
    console.log('❌ [Window Check] BLOCKED: Time is after latest allowed time (end + grace period)');
    console.log(`   Current: ${now.toString()} (${now.getTime()})`);
    console.log(`   Latest: ${latestAllowedTime.toString()} (${latestAllowedTime.getTime()})`);
    console.log(`   Difference: ${((now.getTime() - appointmentEndDateTime.getTime()) / (60 * 1000)).toFixed(2)} minutes after end`);
    return {
      isValid: false,
      message: `The appointment time has passed. The appointment window was from ${appointmentStartDateTime.toLocaleString()} to ${appointmentEndDateTime.toLocaleString()}. Video call is no longer available.`,
      startTime: appointmentStartDateTime,
      endTime: appointmentEndDateTime
    };
  }
  
  // Time is within window
  console.log('✅ [Window Check] ALLOWED: Time is within window');
  console.log(`   Current: ${now.toString()}`);
  console.log(`   Window: ${appointmentStartDateTime.toString()} to ${appointmentEndDateTime.toString()}`);
  console.log(`   Time in window: ${timeDiffMinutes.toFixed(2)} minutes`);
  return {
    isValid: true,
    message: null,
    startTime: appointmentStartDateTime,
    endTime: appointmentEndDateTime
  };
};

/**
 * Middleware to check appointment access for communication
 * Requires:
 * 1. Appointment must be CONFIRMED (doctor accepted)
 * 2. Appointment time must have started
 * 3. User must be either the doctor or patient of the appointment
 */
const requireAppointmentAccess = asyncHandler(async (req, res, next) => {
  const { appointmentId } = req.body.appointmentId ? req.body : { appointmentId: req.params.appointmentId };
  const userId = req.userId;
  const userRole = req.userRole;

  if (!appointmentId) {
    return res.status(400).json({
      success: false,
      message: 'Appointment ID is required',
      errors: [{ field: 'appointmentId', message: 'Appointment ID is required' }]
    });
  }

  // Find appointment
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
      errors: []
    });
  }

  // Check if user is the doctor or patient
  const isDoctor = appointment.doctorId && appointment.doctorId.toString() === userId;
  const isPatient = appointment.patientId && appointment.patientId.toString() === userId;

  if (!isDoctor && !isPatient) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this appointment',
      errors: []
    });
  }

  // Check appointment status - must be CONFIRMED
  if (appointment.status !== 'CONFIRMED') {
    const statusMessages = {
      'PENDING': 'Appointment is pending doctor acceptance. Communication will be available after the doctor accepts the appointment.',
      'REJECTED': 'This appointment was rejected. Communication is not available.',
      'CANCELLED': 'This appointment was cancelled. Communication is not available.',
      'COMPLETED': 'This appointment has been completed. Communication is no longer available.',
      'NO_SHOW': 'This appointment was marked as no-show. Communication is not available.'
    };

    return res.status(403).json({
      success: false,
      message: statusMessages[appointment.status] || 'Communication is not available for this appointment status.',
      errors: []
    });
  }

  // Check if current time is within the appointment window (start to end time)
  // This allows users to join anytime during the appointment window, even if they're late
  const timeWindowCheck = isWithinAppointmentWindow(appointment);
  
  if (!timeWindowCheck.isValid) {
    return res.status(403).json({
      success: false,
      message: timeWindowCheck.message || 'Communication is only available during the scheduled appointment time window.',
      errors: [],
      appointmentDateTime: timeWindowCheck.startTime?.toISOString(),
      appointmentEndTime: timeWindowCheck.endTime?.toISOString()
    });
  }

  // Attach appointment to request for use in controllers
  req.appointment = appointment;
  next();
});

/**
 * Middleware to check appointment access but allow access before time (for getting session info)
 * Still requires CONFIRMED status
 */
const requireConfirmedAppointment = asyncHandler(async (req, res, next) => {
  const { appointmentId } = req.body.appointmentId ? req.body : { appointmentId: req.params.appointmentId };
  const userId = req.userId;

  if (!appointmentId) {
    return res.status(400).json({
      success: false,
      message: 'Appointment ID is required',
      errors: []
    });
  }

  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
      errors: []
    });
  }

  const isDoctor = appointment.doctorId && appointment.doctorId.toString() === userId;
  const isPatient = appointment.patientId && appointment.patientId.toString() === userId;

  if (!isDoctor && !isPatient) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this appointment',
      errors: []
    });
  }

  if (appointment.status !== 'CONFIRMED') {
    return res.status(403).json({
      success: false,
      message: 'Appointment must be confirmed before accessing communication features.',
      errors: []
    });
  }

  req.appointment = appointment;
  next();
});

module.exports = {
  requireAppointmentAccess,
  requireConfirmedAppointment,
  isAppointmentTimeStarted,
  isWithinAppointmentWindow
};












