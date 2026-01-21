const VideoSession = require('../models/videoSession.model');
const Appointment = require('../models/appointment.model');
const streamService = require('./stream.service');
const { isAppointmentTimeStarted } = require('../middleware/appointmentAccess');

/**
 * Start video session for appointment
 * @param {string} appointmentId - Appointment ID
 * @param {string} userId - User ID requesting the session
 * @param {string} userName - User name
 * @returns {Promise<Object>} Created video session with Stream token and call ID
 */
const startSession = async (appointmentId, userId, userName) => {
  console.log(`\n🎥 Starting video session for appointment: ${appointmentId}`);
  console.log(`👤 User: ${userId} (${userName})`);
  
  try {
    const appointment = await Appointment.findById(appointmentId)
      .populate('doctorId', 'fullName')
      .populate('patientId', 'fullName');
    
    if (!appointment) {
      console.error('❌ Appointment not found:', appointmentId);
      throw new Error('Appointment not found');
    }
    
    console.log('✅ Appointment found:', {
      id: appointment._id,
      status: appointment.status,
      bookingType: appointment.bookingType,
      doctorId: appointment.doctorId?._id || appointment.doctorId,
      patientId: appointment.patientId?._id || appointment.patientId
    });

  // Check appointment status - must be CONFIRMED
  if (appointment.status !== 'CONFIRMED') {
    const statusMessages = {
      'PENDING': 'Appointment is pending doctor acceptance. Video call will be available after the doctor accepts the appointment.',
      'REJECTED': 'This appointment was rejected. Video call is not available.',
      'CANCELLED': 'This appointment was cancelled. Video call is not available.',
      'COMPLETED': 'This appointment has been completed. Video call is no longer available.',
      'NO_SHOW': 'This appointment was marked as no-show. Video call is not available.'
    };
    throw new Error(statusMessages[appointment.status] || 'Video call is not available for this appointment status.');
  }

  if (appointment.bookingType !== 'ONLINE') {
    throw new Error('Video call is only available for online appointments');
  }

  // Calculate appointment time window (start and end)
  // Use the same timezone logic as appointmentAccess middleware
  const { parseAppointmentDate } = require('../middleware/appointmentAccess');
  const dateComponents = parseAppointmentDate(appointment.appointmentDate);
  
  if (!dateComponents) {
    throw new Error('Invalid appointment date');
  }
  
  const { year, month, day } = dateComponents;
  
  // Parse appointment time (HH:MM format)
  const [startHours, startMinutes] = appointment.appointmentTime.split(':').map(Number);
  
  // Get timezone offset from appointment (in minutes)
  // Handle both old appointments (no timezone) and new appointments (with timezone)
  let tzOffsetMinutes;
  
  if (appointment.timezoneOffset !== null && appointment.timezoneOffset !== undefined) {
    tzOffsetMinutes = appointment.timezoneOffset;
    console.log('✅ [Video Session] Using stored timezone offset:', tzOffsetMinutes, 'minutes (UTC' + (tzOffsetMinutes >= 0 ? '+' : '') + Math.floor(tzOffsetMinutes / 60) + ')');
  } else {
    // CRITICAL FIX: For old appointments without timezone, assume UTC+5 (Pakistan)
    // Most users are in Pakistan, so this is a reasonable default
    if (startHours >= 12 && startHours <= 23) {
      // Afternoon/evening appointment - likely local time (Pakistan)
      tzOffsetMinutes = 300; // UTC+5
      console.log('⚠️ [Video Session] No timezone stored, assuming UTC+5 (Pakistan) for afternoon/evening appointment');
    } else {
      // Morning appointment - still assume UTC+5 as default
      tzOffsetMinutes = 300; // UTC+5
      console.log('⚠️ [Video Session] No timezone stored, defaulting to UTC+5 (Pakistan)');
    }
  }
  
  // Ensure tzOffsetMinutes is a valid number
  if (typeof tzOffsetMinutes !== 'number' || isNaN(tzOffsetMinutes)) {
    tzOffsetMinutes = 300; // Default to UTC+5 (Pakistan)
    console.log('⚠️ [Video Session] Invalid timezone offset, defaulting to UTC+5 (Pakistan)');
  }
  
  // Create appointment start datetime in UTC, then adjust for timezone
  const appointmentStartDateTimeUTC = new Date(Date.UTC(year, month, day, startHours, startMinutes, 0, 0));
  const appointmentStartDateTime = new Date(appointmentStartDateTimeUTC.getTime() - (tzOffsetMinutes * 60 * 1000));
  
  // Get appointment duration (default 30 minutes if not set)
  const duration = appointment.appointmentDuration || 30;
  
  // Calculate appointment end time - use same timezone logic
  let appointmentEndDateTime;
  if (appointment.appointmentEndTime) {
    const [endHours, endMinutes] = appointment.appointmentEndTime.split(':').map(Number);
    
    let endYear = year;
    let endMonth = month;
    let endDay = day;
    
    const startTimeMinutes = startHours * 60 + startMinutes;
    const endTimeMinutes = endHours * 60 + endMinutes;
    
    if (endTimeMinutes < startTimeMinutes && (startTimeMinutes - endTimeMinutes) > 12 * 60) {
      const nextDay = new Date(Date.UTC(year, month, day + 1));
      endYear = nextDay.getUTCFullYear();
      endMonth = nextDay.getUTCMonth();
      endDay = nextDay.getUTCDate();
    }
    
    const appointmentEndDateTimeUTC = new Date(Date.UTC(endYear, endMonth, endDay, endHours, endMinutes, 0, 0));
    appointmentEndDateTime = new Date(appointmentEndDateTimeUTC.getTime() - (tzOffsetMinutes * 60 * 1000));
    
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
    }
  } else {
    const duration = appointment.appointmentDuration || 30;
    appointmentEndDateTime = new Date(appointmentStartDateTime.getTime() + duration * 60 * 1000);
    if (!appointment.appointmentEndTime) {
      const endTimeStr = `${appointmentEndDateTime.getUTCHours().toString().padStart(2, '0')}:${appointmentEndDateTime.getUTCMinutes().toString().padStart(2, '0')}`;
      appointment.appointmentEndTime = endTimeStr;
      appointment.appointmentDuration = duration;
      await appointment.save();
    }
  }
  
  const now = new Date();
  
  // Allow 2 minutes buffer before appointment start time to account for clock differences
  // Users can join anytime during the appointment window (start to end)
  const bufferTime = 2 * 60 * 1000; // 2 minutes in milliseconds
  const earliestAllowedTime = new Date(appointmentStartDateTime.getTime() - bufferTime);
  
  // IMPORTANT: Check "after end" FIRST to give correct error message when time has passed
  // Check if current time is after appointment end time
  if (now > appointmentEndDateTime) {
    const timeDiffFromEnd = (now.getTime() - appointmentEndDateTime.getTime()) / (60 * 1000);
    console.log('❌ [Video Session] BLOCKED: Time is after end time');
    console.log(`   Current: ${now.toString()} (${now.getTime()})`);
    console.log(`   End: ${appointmentEndDateTime.toString()} (${appointmentEndDateTime.getTime()})`);
    console.log(`   Difference: ${timeDiffFromEnd.toFixed(2)} minutes after end`);
    throw new Error(`The appointment time window has passed. The appointment window was from ${appointmentStartDateTime.toLocaleString()} to ${appointmentEndDateTime.toLocaleString()}. Video call is no longer available.`);
  }
  
  // Check if current time is before earliest allowed time (appointment start - buffer)
  if (now < earliestAllowedTime) {
    const timeDiffFromStart = (now.getTime() - appointmentStartDateTime.getTime()) / (60 * 1000);
    console.log('❌ [Video Session] BLOCKED: Time is before earliest allowed time');
    console.log(`   Current: ${now.toString()} (${now.getTime()})`);
    console.log(`   Earliest: ${earliestAllowedTime.toString()} (${earliestAllowedTime.getTime()})`);
    console.log(`   Start: ${appointmentStartDateTime.toString()} (${appointmentStartDateTime.getTime()})`);
    console.log(`   Difference: ${timeDiffFromStart.toFixed(2)} minutes (negative = before start)`);
    throw new Error(`Video call is only available during the scheduled appointment time window. Your appointment starts at ${appointmentStartDateTime.toLocaleString()} and ends at ${appointmentEndDateTime.toLocaleString()}.`);
  }
  
  // If we reach here, the user is within the appointment window
  // They can join anytime between start and end, even if they're late

  // Check if session already exists
  let session = await VideoSession.findOne({ appointmentId });
  
  // Use appointment ID as Stream call ID for consistency
  const streamCallId = `appointment-${appointmentId}`;
  
  if (!session) {
    console.log('📝 Creating new video session...');
    
    // Create Stream call (optional - frontend can create it too)
    try {
      const streamCall = await streamService.createCall(streamCallId, {
        appointmentId: appointmentId.toString(),
        doctorId: appointment.doctorId._id.toString(),
        patientId: appointment.patientId._id.toString(),
        doctorName: appointment.doctorId.fullName,
        patientName: appointment.patientId.fullName,
      });
      if (streamCall) {
        console.log('✅ Stream call created on backend');
      } else {
        console.log('ℹ️  Stream call will be created by frontend');
      }
    } catch (streamError) {
      console.error('❌ Failed to create Stream call:', streamError);
      // Don't throw - frontend can create the call
      console.warn('⚠️  Continuing without backend call creation');
    }

    // Create new session
    try {
      session = await VideoSession.create({
        appointmentId,
        doctorId: appointment.doctorId._id,
        patientId: appointment.patientId._id,
        sessionId: streamCallId,
        startedAt: new Date()
      });
      console.log('✅ Video session created in database:', session._id);
    } catch (dbError) {
      console.error('❌ Failed to create video session in database:', dbError);
      throw dbError;
    }

    // Link session to appointment
    appointment.videoSessionId = session._id;
    await appointment.save();
    console.log('✅ Session linked to appointment');
  } else {
    console.log('📝 Updating existing video session:', session._id);
    // Update existing session
    session.startedAt = new Date();
    await session.save();
  }

  // Generate Stream token for user
  console.log('🔑 Generating Stream token...');
  let streamToken;
  try {
    streamToken = streamService.generateUserToken(userId, userName);
    console.log('✅ Stream token generated');
  } catch (tokenError) {
    console.error('❌ Failed to generate Stream token:', tokenError);
    throw tokenError;
  }

  console.log('✅ Video session started successfully');
  console.log('📊 Session data:', {
    sessionId: session._id,
    streamCallId,
    hasToken: !!streamToken
  });

  return {
    session,
    streamToken,
    streamCallId,
  };
  } catch (error) {
    console.error('❌ Error in startSession:', error);
    console.error('❌ Error stack:', error.stack);
    throw error;
  }
};

/**
 * End video session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Updated session
 */
const endSession = async (sessionId) => {
  const session = await VideoSession.findById(sessionId);
  
  if (!session) {
    throw new Error('Video session not found');
  }

  // End Stream call
  if (session.sessionId) {
    try {
      await streamService.endCall(session.sessionId);
    } catch (error) {
      console.error('Error ending Stream call:', error);
      // Continue even if Stream call ending fails
    }
  }

  session.endedAt = new Date();
  await session.save();

  return session;
};

/**
 * Get session by appointment ID
 * @param {string} appointmentId - Appointment ID
 * @param {string} userId - User ID requesting the session
 * @param {string} userName - User name
 * @returns {Promise<Object>} Video session with Stream token
 */
const getSessionByAppointment = async (appointmentId, userId, userName) => {
  const session = await VideoSession.findOne({ appointmentId })
    .populate('doctorId', 'fullName email phone profileImage')
    .populate('patientId', 'fullName email phone profileImage');
  
  if (!session) {
    throw new Error('Video session not found');
  }

  // Generate Stream token for user
  const streamToken = streamService.generateUserToken(userId, userName);

  return {
    session,
    streamToken,
    streamCallId: session.sessionId,
  };
};

module.exports = {
  startSession,
  endSession,
  getSessionByAppointment
};

