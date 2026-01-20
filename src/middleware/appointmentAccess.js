const Appointment = require('../models/appointment.model');
const asyncHandler = require('./asyncHandler');

/**
 * Parse appointment date to get year, month, day components
 * CRITICAL: Handles timezone issues by always using local date components
 * MongoDB stores dates in UTC, but we need to extract the date as the user intended (local date)
 */
const parseAppointmentDate = (appointmentDate) => {
  if (!appointmentDate) {
    return null;
  }
  
  // If it's a Date object (from MongoDB), extract the date components
  // CRITICAL: MongoDB stores dates in UTC, but appointments are created with local dates
  // We need to get the date as the user intended it, not as UTC interprets it
  if (appointmentDate instanceof Date) {
    // Try to get the date from ISO string first (most reliable)
    const isoString = appointmentDate.toISOString();
    const dateOnly = isoString.split('T')[0]; // Get YYYY-MM-DD part
    const [y, m, d] = dateOnly.split('-').map(Number);
    
    // Also get local components for comparison
    const localYear = appointmentDate.getFullYear();
    const localMonth = appointmentDate.getMonth();
    const localDay = appointmentDate.getDate();
    const utcYear = appointmentDate.getUTCFullYear();
    const utcMonth = appointmentDate.getUTCMonth();
    const utcDay = appointmentDate.getUTCDate();
    
    // Use ISO date components (from UTC storage) - this is what was originally stored
    // This ensures we get the correct date regardless of server timezone
    const year = y;
    const month = m - 1; // JavaScript months are 0-indexed
    const day = d;
    
    console.log('📅 [Date Parse] Date object parsed:', {
      originalISO: isoString,
      originalLocal: appointmentDate.toString(),
      usingISO: { year, month: month + 1, day },
      localComponents: { year: localYear, month: localMonth + 1, day: localDay },
      utcComponents: { year: utcYear, month: utcMonth + 1, day: utcDay },
      difference: (year !== localYear || month !== localMonth || day !== localDay) ? 'DIFFERENT' : 'SAME'
    });
    
    return { year, month, day };
  }
  
  // For strings, parse directly to avoid timezone conversion
  const dateStr = appointmentDate.toString();
  
  // Try ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
  if (dateStr.includes('T')) {
    const dateOnly = dateStr.split('T')[0];
    const [y, m, d] = dateOnly.split('-').map(Number);
    console.log('📅 [Date Parse] ISO string parsed:', { dateStr, dateOnly, year: y, month: m - 1, day: d });
    return {
      year: y,
      month: m - 1, // JavaScript months are 0-indexed
      day: d
    };
  }
  
  // Try YYYY-MM-DD format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    console.log('📅 [Date Parse] YYYY-MM-DD string parsed:', { dateStr, year: y, month: m - 1, day: d });
    return {
      year: y,
      month: m - 1,
      day: d
    };
  }
  
  // Fallback: parse as Date and get local components
  const dateObj = new Date(appointmentDate);
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const day = dateObj.getDate();
  console.log('📅 [Date Parse] Fallback parsing:', { dateStr, year, month, day });
  return { year, month, day };
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
    console.error('❌ [Window Check] Failed to parse appointment date:', appointment.appointmentDate);
    return {
      isValid: false,
      message: 'Invalid appointment date',
      startTime: null,
      endTime: null
    };
  }
  
  const { year, month, day } = dateComponents;
  
  // Log the parsed date components
  console.log('📅 [Window Check] Parsed date components:', { year, month, day, appointmentDate: appointment.appointmentDate });
  
  // Parse appointment time (HH:MM format) - this is in local timezone
  const [startHours, startMinutes] = appointment.appointmentTime.split(':').map(Number);
  
  // Create appointment start datetime using local timezone constructor
  // This combines the date with local time
  const appointmentStartDateTime = new Date(year, month, day, startHours, startMinutes, 0, 0);
  
  // Calculate appointment end time
  let appointmentEndDateTime;
  if (appointment.appointmentEndTime) {
    const [endHours, endMinutes] = appointment.appointmentEndTime.split(':').map(Number);
    
    // Handle end time that might be on the next day
    // For example: 12:00 AM to 1:00 AM means end is on the same day
    // But 11:00 PM to 12:30 AM means end is on the next day
    let endYear = year;
    let endMonth = month;
    let endDay = day;
    
    // Check if end time is on the next day
    // This happens when end time is earlier than start time (e.g., 00:30 vs 23:30)
    // OR when both are on same day but end time would logically be next day
    const startTimeMinutes = startHours * 60 + startMinutes;
    const endTimeMinutes = endHours * 60 + endMinutes;
    
    // If end time is significantly earlier than start (more than 12 hours difference),
    // it's likely on the next day
    if (endTimeMinutes < startTimeMinutes && (startTimeMinutes - endTimeMinutes) > 12 * 60) {
      // End time is on the next day
      const nextDay = new Date(year, month, day + 1);
      endYear = nextDay.getFullYear();
      endMonth = nextDay.getMonth();
      endDay = nextDay.getDate();
    }
    
    appointmentEndDateTime = new Date(endYear, endMonth, endDay, endHours, endMinutes, 0, 0);
    
    // Additional validation: if calculated end time is before start time, it must be next day
    if (appointmentEndDateTime < appointmentStartDateTime) {
      const nextDay = new Date(year, month, day + 1);
      appointmentEndDateTime = new Date(
        nextDay.getFullYear(),
        nextDay.getMonth(),
        nextDay.getDate(),
        endHours,
        endMinutes,
        0,
        0
      );
    }
  } else {
    // Calculate from duration (default 30 minutes)
    const duration = appointment.appointmentDuration || 30;
    appointmentEndDateTime = new Date(appointmentStartDateTime.getTime() + duration * 60 * 1000);
  }
  
  // Allow small buffer before appointment start time (2 minutes) to account for clock differences
  // Users can join anytime during the appointment window (start to end)
  const bufferTime = 2 * 60 * 1000; // 2 minutes buffer
  const earliestAllowedTime = new Date(appointmentStartDateTime.getTime() - bufferTime);
  
  // Debug logging to help diagnose timezone issues
  const timeDiff = now.getTime() - appointmentStartDateTime.getTime();
  const timeDiffMinutes = timeDiff / (60 * 1000);
  const timeDiffFromEnd = (now.getTime() - appointmentEndDateTime.getTime()) / (60 * 1000);
  const isValid = now >= earliestAllowedTime && now <= appointmentEndDateTime;
  
  console.log('🕐 [Window Check] DETAILED ANALYSIS', {
    now: {
      iso: now.toISOString(),
      local: now.toString(),
      timestamp: now.getTime(),
      hours: now.getHours(),
      minutes: now.getMinutes(),
      date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    },
    appointment: {
      dateRaw: appointment.appointmentDate,
      dateType: typeof appointment.appointmentDate,
      dateIsDate: appointment.appointmentDate instanceof Date,
      dateString: appointment.appointmentDate?.toString(),
      dateISO: appointment.appointmentDate instanceof Date ? appointment.appointmentDate.toISOString() : 'N/A',
      time: appointment.appointmentTime,
      endTime: appointment.appointmentEndTime,
      duration: appointment.appointmentDuration
    },
    parsed: {
      year, month, day,
      startHours, startMinutes
    },
    calculated: {
      startDateTime: {
        iso: appointmentStartDateTime.toISOString(),
        local: appointmentStartDateTime.toString(),
        timestamp: appointmentStartDateTime.getTime(),
        hours: appointmentStartDateTime.getHours(),
        minutes: appointmentStartDateTime.getMinutes()
      },
      endDateTime: {
        iso: appointmentEndDateTime.toISOString(),
        local: appointmentEndDateTime.toString(),
        timestamp: appointmentEndDateTime.getTime(),
        hours: appointmentEndDateTime.getHours(),
        minutes: appointmentEndDateTime.getMinutes()
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
      timeDifferenceFromEndMinutes: timeDiffFromEnd.toFixed(2),
      isBeforeStart: now < earliestAllowedTime,
      isAfterEnd: now > appointmentEndDateTime,
      isValid: isValid,
      reason: !isValid ? (now < earliestAllowedTime ? 'BEFORE_START' : 'AFTER_END') : 'WITHIN_WINDOW'
    }
  });
  
  // IMPORTANT: Check "after end" FIRST to give correct error message when time has passed
  // Check if current time is after end time
  if (now > appointmentEndDateTime) {
    console.log('❌ [Window Check] BLOCKED: Time is after end time');
    console.log(`   Current: ${now.toString()} (${now.getTime()})`);
    console.log(`   End: ${appointmentEndDateTime.toString()} (${appointmentEndDateTime.getTime()})`);
    console.log(`   Difference: ${timeDiffFromEnd.toFixed(2)} minutes after end`);
    return {
      isValid: false,
      message: `The appointment time has passed. The appointment window was from ${appointmentStartDateTime.toLocaleString()} to ${appointmentEndDateTime.toLocaleString()}. Video call is no longer available.`,
      startTime: appointmentStartDateTime,
      endTime: appointmentEndDateTime
    };
  }
  
  // Check if current time is before earliest allowed time (appointment start - buffer)
  if (now < earliestAllowedTime) {
    console.log('❌ [Window Check] BLOCKED: Time is before earliest allowed time');
    console.log(`   Current: ${now.toString()} (${now.getTime()})`);
    console.log(`   Earliest: ${earliestAllowedTime.toString()} (${earliestAllowedTime.getTime()})`);
    console.log(`   Start: ${appointmentStartDateTime.toString()} (${appointmentStartDateTime.getTime()})`);
    console.log(`   Difference: ${timeDiffMinutes.toFixed(2)} minutes (negative = before start)`);
    return {
      isValid: false,
      message: `Video call is only available during the scheduled appointment time window. Your appointment starts at ${appointmentStartDateTime.toLocaleString()} and ends at ${appointmentEndDateTime.toLocaleString()}.`,
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
  isWithinAppointmentWindow,
  parseAppointmentDate
};












