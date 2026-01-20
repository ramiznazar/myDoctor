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
  // Handle timezone correctly - parse appointment date properly
  let year, month, day;
  
  // Parse appointment date - handle both Date objects and strings
  if (appointment.appointmentDate instanceof Date) {
    // For Date objects, use local date components (what user expects)
    year = appointment.appointmentDate.getFullYear();
    month = appointment.appointmentDate.getMonth();
    day = appointment.appointmentDate.getDate();
  } else {
    // For strings, parse directly to avoid timezone conversion
    const dateStr = appointment.appointmentDate.toString();
    
    if (dateStr.includes('T')) {
      const dateOnly = dateStr.split('T')[0];
      const [y, m, d] = dateOnly.split('-').map(Number);
      year = y;
      month = m - 1; // JavaScript months are 0-indexed
      day = d;
    } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [y, m, d] = dateStr.split('-').map(Number);
      year = y;
      month = m - 1;
      day = d;
    } else {
      // Fallback
      const dateObj = new Date(appointment.appointmentDate);
      year = dateObj.getFullYear();
      month = dateObj.getMonth();
      day = dateObj.getDate();
    }
  }
  
  // Parse appointment time (HH:MM format) - this is in local timezone
  const [startHours, startMinutes] = appointment.appointmentTime.split(':').map(Number);
  
  // Create appointment start datetime using local timezone constructor
  const appointmentStartDateTime = new Date(year, month, day, startHours, startMinutes, 0, 0);
  
  // Get appointment duration (default 30 minutes if not set)
  const duration = appointment.appointmentDuration || 30;
  
  // Calculate appointment end time
  let appointmentEndDateTime;
  if (appointment.appointmentEndTime) {
    // Use stored end time if available
    const [endHours, endMinutes] = appointment.appointmentEndTime.split(':').map(Number);
    appointmentEndDateTime = new Date(year, month, day, endHours, endMinutes, 0, 0);
  } else {
    // Calculate from start time + duration
    appointmentEndDateTime = new Date(appointmentStartDateTime.getTime() + duration * 60 * 1000);
    // Update appointment with calculated end time if not set
    if (!appointment.appointmentEndTime) {
      const endTimeStr = `${appointmentEndDateTime.getHours().toString().padStart(2, '0')}:${appointmentEndDateTime.getMinutes().toString().padStart(2, '0')}`;
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
  
  // Check if current time is before earliest allowed time (appointment start - buffer)
  if (now < earliestAllowedTime) {
    throw new Error(`Video call is only available during the scheduled appointment time window. Your appointment starts at ${appointmentStartDateTime.toLocaleString()} and ends at ${appointmentEndDateTime.toLocaleString()}.`);
  }
  
  // Check if current time is after appointment end time
  // This is the only hard limit - once the window has passed, the call is no longer available
  if (now > appointmentEndDateTime) {
    throw new Error(`The appointment time window has passed. The appointment window was from ${appointmentStartDateTime.toLocaleString()} to ${appointmentEndDateTime.toLocaleString()}. Video call is no longer available.`);
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

