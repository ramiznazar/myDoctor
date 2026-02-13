const Appointment = require('../models/appointment.model');
const asyncHandler = require('./asyncHandler');

const isPakistanUser = (user) => {
  if (!user || typeof user !== 'object') return false;
  const country = String(user?.address?.country || '').toLowerCase();
  const phone = String(user?.phone || '');
  return country.includes('pakistan') || country === 'pk' || phone.startsWith('+92');
};

const formatWithOffset = (dateUTC, offsetMinutes) => {
  if (!(dateUTC instanceof Date) || typeof offsetMinutes !== 'number' || Number.isNaN(offsetMinutes)) {
    return null;
  }
  return new Date(dateUTC.getTime() + offsetMinutes * 60 * 1000).toUTCString();
};

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
  // CRITICAL FIX: The appointment date represents a calendar date, not a specific moment in time
  // When stored in MongoDB as UTC, we need to reconstruct the original calendar date
  // Strategy: Check both local and UTC components, and use the one that makes sense
  // For appointments created with local midnight, the local date is correct
  // For appointments created with UTC interpretation, we need to check the UTC hours
  if (appointmentDate instanceof Date) {
    const localYear = appointmentDate.getFullYear();
    const localMonth = appointmentDate.getMonth();
    const localDay = appointmentDate.getDate();
    
    const utcYear = appointmentDate.getUTCFullYear();
    const utcMonth = appointmentDate.getUTCMonth();
    const utcDay = appointmentDate.getUTCDate();
    const utcHours = appointmentDate.getUTCHours();
    const utcMinutes = appointmentDate.getUTCMinutes();
    
    const isoString = appointmentDate.toISOString();
    const isoDateOnly = isoString.split('T')[0];
    
    let year, month, day;
    
    // If UTC time is exactly midnight (00:00:00), the date was stored as UTC midnight
    // In this case, use UTC date components
    if (utcHours === 0 && utcMinutes === 0 && localDay !== utcDay) {
      // Stored as UTC midnight - use UTC date
      year = utcYear;
      month = utcMonth;
      day = utcDay;
      console.log('📅 [Date Parse] Using UTC date (stored as UTC midnight)');
    } else if (localDay === utcDay) {
      // Same day in both - use local (most common case for appointments stored as local midnight)
      year = localYear;
      month = localMonth;
      day = localDay;
      console.log('📅 [Date Parse] Using LOCAL date (same day in both timezones)');
    } else {
      // Days differ - this means the date was stored as local midnight
      // When stored as local midnight in a timezone ahead of UTC, it becomes previous day in UTC
      // Use LOCAL date components to get back the original calendar date
      year = localYear;
      month = localMonth;
      day = localDay;
      console.log('📅 [Date Parse] Using LOCAL date (days differ - appointment is local calendar date)');
    }
    
    console.log('📅 [Date Parse] Date object parsed:', {
      originalISO: isoString,
      originalLocal: appointmentDate.toString(),
      using: { year, month: month + 1, day },
      localComponents: { year: localYear, month: localMonth + 1, day: localDay },
      utcComponents: { year: utcYear, month: utcMonth + 1, day: utcDay, hours: utcHours, minutes: utcMinutes },
      isoDateOnly: isoDateOnly,
      decision: localDay === utcDay ? 'SAME_DAY' : 'DIFFERENT_DAY'
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

  // Parse appointment time (HH:MM format)
  // CRITICAL: Use stored timezone to interpret the time correctly
  const [startHours, startMinutes] = appointment.appointmentTime.split(':').map(Number);
  
  // Get timezone offset from appointment (in minutes, e.g., 300 for UTC+5)
  // CRITICAL: For old appointments without timezone, we need to handle them differently
  let tzOffsetMinutes;
  
  console.log('🔍 [Window Check] Checking timezone:', {
    hasTimezone: !!appointment.timezone,
    timezone: appointment.timezone,
    hasTimezoneOffset: appointment.timezoneOffset !== null && appointment.timezoneOffset !== undefined,
    timezoneOffset: appointment.timezoneOffset,
    appointmentTime: appointment.appointmentTime
  });
  
  if (appointment.timezoneOffset !== null && appointment.timezoneOffset !== undefined) {
    tzOffsetMinutes = appointment.timezoneOffset;
    console.log('✅ [Window Check] Using stored timezone offset:', tzOffsetMinutes, 'minutes (UTC' + (tzOffsetMinutes >= 0 ? '+' : '') + Math.floor(tzOffsetMinutes / 60) + ')');
  } else {
    // CRITICAL FIX: For old appointments without timezone, the appointment time was likely
    // created in the user's local timezone (Pakistan UTC+5), but stored without timezone info
    // Since we can't know for sure, we'll try to infer it from the appointment time pattern
    // 
    // However, the safest approach for now is to assume the appointment time is already in UTC
    // This means old appointments will be interpreted as UTC, which may cause issues
    // 
    // BETTER: We should update old appointments to have timezone info, but for now:
    // If the appointment time is in a reasonable range (e.g., 9 AM - 9 PM), it's likely local time
    // For Pakistan, common appointment times are 9 AM - 9 PM local = 4 AM - 4 PM UTC
    // If the appointment time is 17:45 (5:45 PM), it's very likely in local time (Pakistan)
    // So we'll assume UTC+5 (300 minutes) for appointments in the 12:00-23:59 range
    if (startHours >= 12 && startHours <= 23) {
      // Likely a local time appointment (afternoon/evening in Pakistan)
      // Assume UTC+5 (Pakistan timezone)
      tzOffsetMinutes = 300; // UTC+5
      console.log('⚠️ [Window Check] No timezone stored, but appointment time suggests local time (afternoon/evening)');
      console.log('⚠️ [Window Check] Assuming UTC+5 (Pakistan) for this appointment');
    } else {
      // Morning appointments - still assume UTC+5 (Pakistan) as default since most users are in Pakistan
      tzOffsetMinutes = 300; // UTC+5
      console.log('⚠️ [Window Check] No timezone stored, defaulting to UTC+5 (Pakistan) for morning appointment');
    }
  }
  
  // Ensure tzOffsetMinutes is a valid number
  if (typeof tzOffsetMinutes !== 'number' || isNaN(tzOffsetMinutes)) {
    tzOffsetMinutes = 300; // Default to UTC+5 (Pakistan) as fallback
    console.log('⚠️ [Window Check] Invalid timezone offset, defaulting to UTC+5 (Pakistan)');
  }

  if (
    tzOffsetMinutes === 60 &&
    !appointment.timezone &&
    (isPakistanUser(appointment.patientId) || isPakistanUser(appointment.doctorId))
  ) {
    tzOffsetMinutes = 300;
    console.log('⚠️ [Window Check] Overriding timezone offset to UTC+5 based on user country/phone');
  }

  if (typeof appointment.timezone === 'string') {
    const tzMatch = appointment.timezone.match(/UTC([+-])(\d+)/);
    if (tzMatch) {
      const sign = tzMatch[1];
      const expected = (sign === '+' ? 1 : -1) * parseInt(tzMatch[2], 10) * 60;
      if (typeof tzOffsetMinutes === 'number' && !Number.isNaN(expected) && tzOffsetMinutes === -expected) {
        tzOffsetMinutes = expected;
        console.log('⚠️ [Window Check] Normalized timezone offset sign to match timezone string');
      }
    }
  }

  // Derive the intended calendar date in the appointment's timezone.
  // appointment.appointmentDate is stored as a Date in Mongo (UTC internally). If it was saved as
  // local midnight (common), the UTC date part can appear as the previous day.
  const appointmentDateUTC = appointment.appointmentDate instanceof Date
    ? appointment.appointmentDate
    : new Date(appointment.appointmentDate);
  const appointmentDateInTz = new Date(appointmentDateUTC.getTime() + tzOffsetMinutes * 60 * 1000);
  const year = appointmentDateInTz.getUTCFullYear();
  const month = appointmentDateInTz.getUTCMonth();
  const day = appointmentDateInTz.getUTCDate();

  console.log('📅 [Window Check] Calendar date derived with offset:', {
    appointmentDateRaw: appointment.appointmentDate,
    timezoneOffset: tzOffsetMinutes,
    appointmentDateUTC: appointmentDateUTC.toISOString(),
    appointmentDateInTz: appointmentDateInTz.toISOString(),
    year,
    month: month + 1,
    day
  });
  
  // Create appointment start datetime in UTC
  // CRITICAL: The appointment time (e.g., "17:45") is in the user's local timezone
  // To convert local time to UTC: UTC = LocalTime - Offset
  // Example: 17:45 in UTC+5 (300 min offset) = 17:45 - 5 hours = 12:45 UTC
  const appointmentStartDateTimeUTC = new Date(Date.UTC(year, month, day, startHours, startMinutes, 0, 0));
  // Subtract offset to convert from local time to UTC
  const appointmentStartDateTime = new Date(appointmentStartDateTimeUTC.getTime() - (tzOffsetMinutes * 60 * 1000));
  
  console.log('🌍 [Window Check] Timezone conversion:', {
    timezone: appointment.timezone,
    timezoneOffset: tzOffsetMinutes,
    appointmentTime: appointment.appointmentTime,
    parsedDate: { year, month, day },
    step1_createdAsUTC: appointmentStartDateTimeUTC.toISOString(),
    step2_subtractedOffset: `Subtracted ${tzOffsetMinutes} minutes (${Math.floor(tzOffsetMinutes / 60)} hours)`,
    finalUTC: appointmentStartDateTime.toISOString(),
    finalUTCHours: appointmentStartDateTime.getUTCHours(),
    finalUTCMinutes: appointmentStartDateTime.getUTCMinutes(),
    explanation: `Appointment ${startHours}:${startMinutes.toString().padStart(2, '0')} in UTC${tzOffsetMinutes >= 0 ? '+' : ''}${Math.floor(tzOffsetMinutes / 60)} = ${appointmentStartDateTime.toISOString()} UTC`
  });
  
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
      const nextDay = new Date(Date.UTC(year, month, day + 1));
      endYear = nextDay.getUTCFullYear();
      endMonth = nextDay.getUTCMonth();
      endDay = nextDay.getUTCDate();
    }
    
    // Create end datetime in UTC, then adjust for timezone (same as start time)
    const appointmentEndDateTimeUTC = new Date(Date.UTC(endYear, endMonth, endDay, endHours, endMinutes, 0, 0));
    appointmentEndDateTime = new Date(appointmentEndDateTimeUTC.getTime() - (tzOffsetMinutes * 60 * 1000));
    
    // Additional validation: if calculated end time is before start time, it must be next day
    if (appointmentEndDateTime <= appointmentStartDateTime) {
      const nextDay = new Date(Date.UTC(year, month, day + 1));
      const nextDayUTC = new Date(Date.UTC(
        nextDay.getUTCFullYear(),
        nextDay.getUTCMonth(),
        nextDay.getUTCDate(),
        endHours,
        endMinutes,
        0,
        0
      ));
      appointmentEndDateTime = new Date(nextDayUTC.getTime() - (tzOffsetMinutes * 60 * 1000));
      console.log('⚠️ [Window Check] End time was before start, adjusted to next day');
    }
  } else {
    // Calculate from duration (default 30 minutes)
    const duration = appointment.appointmentDuration || 30;
    appointmentEndDateTime = new Date(appointmentStartDateTime.getTime() + duration * 60 * 1000);
  }
  
  // CRITICAL: Compare times in UTC to avoid timezone issues
  // Both appointment times and current time are now in UTC
  const nowUTC = new Date(); // Current time (JavaScript Date is always UTC internally)
  
  // Allow small buffer before appointment start time (2 minutes) to account for clock differences
  // Users can join anytime during the appointment window (start to end)
  const bufferTime = 2 * 60 * 1000; // 2 minutes buffer
  const earliestAllowedTime = new Date(appointmentStartDateTime.getTime() - bufferTime);
  
  // Debug logging to help diagnose timezone issues
  const timeDiff = nowUTC.getTime() - appointmentStartDateTime.getTime();
  const timeDiffMinutes = timeDiff / (60 * 1000);
  const timeDiffFromEnd = (nowUTC.getTime() - appointmentEndDateTime.getTime()) / (60 * 1000);
  const timeDiffFromEarliest = (nowUTC.getTime() - earliestAllowedTime.getTime()) / (60 * 1000);
  
  // Check validation with detailed logging
  const isAfterEarliest = nowUTC >= earliestAllowedTime;
  const isBeforeEnd = nowUTC <= appointmentEndDateTime;
  const isValid = isAfterEarliest && isBeforeEnd;
  
  console.log('🕐 [Window Check] DETAILED ANALYSIS', {
    now: {
      iso: nowUTC.toISOString(),
      local: nowUTC.toString(),
      utc: nowUTC.toUTCString(),
      timestamp: nowUTC.getTime(),
      hoursUTC: nowUTC.getUTCHours(),
      minutesUTC: nowUTC.getUTCMinutes(),
      hoursLocal: nowUTC.getHours(),
      minutesLocal: nowUTC.getMinutes(),
      dateUTC: `${nowUTC.getUTCFullYear()}-${String(nowUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(nowUTC.getUTCDate()).padStart(2, '0')}`,
      dateLocal: `${nowUTC.getFullYear()}-${String(nowUTC.getMonth() + 1).padStart(2, '0')}-${String(nowUTC.getDate()).padStart(2, '0')}`
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
        utc: appointmentStartDateTime.toUTCString(),
        local: appointmentStartDateTime.toString(),
        timestamp: appointmentStartDateTime.getTime(),
        hoursUTC: appointmentStartDateTime.getUTCHours(),
        minutesUTC: appointmentStartDateTime.getUTCMinutes(),
        hoursLocal: appointmentStartDateTime.getHours(),
        minutesLocal: appointmentStartDateTime.getMinutes()
      },
      endDateTime: {
        iso: appointmentEndDateTime.toISOString(),
        utc: appointmentEndDateTime.toUTCString(),
        local: appointmentEndDateTime.toString(),
        timestamp: appointmentEndDateTime.getTime(),
        hoursUTC: appointmentEndDateTime.getUTCHours(),
        minutesLocal: appointmentEndDateTime.getUTCMinutes(),
        hoursLocal: appointmentEndDateTime.getHours(),
        minutesLocal: appointmentEndDateTime.getMinutes()
      },
      earliestAllowed: {
        iso: earliestAllowedTime.toISOString(),
        utc: earliestAllowedTime.toUTCString(),
        local: earliestAllowedTime.toString(),
        timestamp: earliestAllowedTime.getTime()
      }
    },
    comparison: {
      timeDifferenceMs: timeDiff,
      timeDifferenceMinutes: timeDiffMinutes.toFixed(2),
      timeDifferenceFromEndMinutes: timeDiffFromEnd.toFixed(2),
      timeDifferenceFromEarliestMinutes: timeDiffFromEarliest.toFixed(2),
      isBeforeEarliest: !isAfterEarliest,
      isAfterEnd: !isBeforeEnd,
      isAfterEarliest: isAfterEarliest,
      isBeforeEnd: isBeforeEnd,
      isValid: isValid,
      reason: !isValid ? (!isAfterEarliest ? 'BEFORE_START' : 'AFTER_END') : 'WITHIN_WINDOW',
      validationDetails: {
        'now >= earliestAllowedTime': isAfterEarliest,
        'now <= appointmentEndDateTime': isBeforeEnd,
        'combined': isValid
      }
    }
  });
  
  // IMPORTANT: Check "after end" FIRST to give correct error message when time has passed
  // Check if current time is after end time (using UTC comparison)
  if (nowUTC > appointmentEndDateTime) {
    console.log('❌ [Window Check] BLOCKED: Time is after end time');
    console.log(`   Current UTC: ${nowUTC.toUTCString()} (${nowUTC.getTime()})`);
    console.log(`   Current Local: ${nowUTC.toString()}`);
    console.log(`   End UTC: ${appointmentEndDateTime.toUTCString()} (${appointmentEndDateTime.getTime()})`);
    console.log(`   End Local: ${appointmentEndDateTime.toString()}`);
    console.log(`   Difference: ${timeDiffFromEnd.toFixed(2)} minutes after end`);
    return {
      isValid: false,
      message: `The appointment time has passed. The appointment window was from ${appointmentStartDateTime.toUTCString()} to ${appointmentEndDateTime.toUTCString()}. Chat is no longer available.`,
      startTime: appointmentStartDateTime,
      endTime: appointmentEndDateTime
    };
  }
  
  // Check if current time is before earliest allowed time (appointment start - buffer)
  if (nowUTC < earliestAllowedTime) {
    console.log('❌ [Window Check] BLOCKED: Time is before earliest allowed time');
    console.log(`   Current UTC: ${nowUTC.toUTCString()} (${nowUTC.getTime()})`);
    console.log(`   Current Local: ${nowUTC.toString()}`);
    console.log(`   Earliest UTC: ${earliestAllowedTime.toUTCString()} (${earliestAllowedTime.getTime()})`);
    console.log(`   Earliest Local: ${earliestAllowedTime.toString()}`);
    console.log(`   Start UTC: ${appointmentStartDateTime.toUTCString()} (${appointmentStartDateTime.getTime()})`);
    console.log(`   Start Local: ${appointmentStartDateTime.toString()}`);
    console.log(`   Difference from earliest: ${timeDiffFromEarliest.toFixed(2)} minutes (negative = before start)`);
    console.log(`   Difference from start: ${timeDiffMinutes.toFixed(2)} minutes (negative = before start)`);
    
    const startLocal = formatWithOffset(appointmentStartDateTime, tzOffsetMinutes);
    const endLocal = formatWithOffset(appointmentEndDateTime, tzOffsetMinutes);
    const nowLocal = formatWithOffset(nowUTC, tzOffsetMinutes);
    return {
      isValid: false,
      message: `Chat is only available during the scheduled appointment time window. Your appointment starts at ${startLocal || appointmentStartDateTime.toUTCString()} and ends at ${endLocal || appointmentEndDateTime.toUTCString()}. Current time: ${nowLocal || nowUTC.toUTCString()}.`,
      startTime: appointmentStartDateTime,
      endTime: appointmentEndDateTime
    };
  }
  
  // Time is within window
  console.log('✅ [Window Check] ALLOWED: Time is within window');
  console.log(`   Current UTC: ${nowUTC.toUTCString()}`);
  console.log(`   Current Local: ${nowUTC.toString()}`);
  console.log(`   Window UTC: ${appointmentStartDateTime.toUTCString()} to ${appointmentEndDateTime.toUTCString()}`);
  console.log(`   Window Local: ${appointmentStartDateTime.toString()} to ${appointmentEndDateTime.toString()}`);
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
  const appointment = await Appointment.findById(appointmentId)
    .populate('doctorId', 'phone address')
    .populate('patientId', 'phone address');
  
  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: 'Appointment not found',
      errors: []
    });
  }

  // Check if user is the doctor or patient
  const doctorIdStr = typeof appointment.doctorId === 'object' && appointment.doctorId !== null
    ? appointment.doctorId._id?.toString()
    : appointment.doctorId?.toString();
  const patientIdStr = typeof appointment.patientId === 'object' && appointment.patientId !== null
    ? appointment.patientId._id?.toString()
    : appointment.patientId?.toString();
  const isDoctor = !!doctorIdStr && doctorIdStr === userId;
  const isPatient = !!patientIdStr && patientIdStr === userId;

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












