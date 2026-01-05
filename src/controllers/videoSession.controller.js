const asyncHandler = require('../middleware/asyncHandler');
const videoSessionService = require('../services/videoSession.service');

/**
 * Start video session
 */
exports.startSession = asyncHandler(async (req, res) => {
  try {
    console.log('\n🚀 [VIDEO] Start session request received');
    console.log('📋 Request body:', req.body);
    console.log('👤 User ID:', req.userId);
    console.log('👤 User:', req.user?.fullName || req.user?.email);
    
    const { appointmentId } = req.body;
    const userId = req.userId;
    const userName = req.user?.fullName || req.user?.email || 'User';
    
    if (!appointmentId) {
      console.error('❌ Missing appointmentId in request');
      return res.status(400).json({
        success: false,
        message: 'Appointment ID is required',
        errors: [{ field: 'appointmentId', message: 'Appointment ID is required' }]
      });
    }
    
    const result = await videoSessionService.startSession(
      appointmentId,
      userId,
      userName
    );
    
    console.log('✅ [VIDEO] Session started successfully');
    console.log('📊 Response data:', {
      sessionId: result.session._id,
      streamCallId: result.streamCallId,
      hasToken: !!result.streamToken
    });
    
    res.json({ 
      success: true, 
      message: 'Video session started', 
      data: {
        sessionId: result.session._id,
        streamToken: result.streamToken,
        streamCallId: result.streamCallId,
        session: result.session
      }
    });
  } catch (error) {
    console.error('❌ [VIDEO] Error in startSession controller:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
    // Re-throw to let asyncHandler handle it
    throw error;
  }
});

/**
 * End video session
 */
exports.endSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  const result = await videoSessionService.endSession(sessionId);
  res.json({ success: true, message: 'Video session ended', data: result });
});

/**
 * Get session by appointment ID
 */
exports.getByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const userId = req.userId;
  const userName = req.user?.fullName || req.user?.email || 'User';
  
  const result = await videoSessionService.getSessionByAppointment(
    appointmentId,
    userId,
    userName
  );
  
  res.json({ 
    success: true, 
    message: 'OK', 
    data: {
      sessionId: result.session._id,
      streamToken: result.streamToken,
      streamCallId: result.streamCallId,
      session: result.session
    }
  });
});

