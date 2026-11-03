const asyncHandler = require('../middleware/asyncHandler');
const videoSessionService = require('../services/videoSession.service');

const serializeSessionCredentials = (result) => ({
  sessionId: result.session._id,
  streamToken: result.streamToken,
  streamCallId: result.streamCallId,
  streamApiKey: result.streamApiKey,
  streamMembers: result.streamMembers,
  session: result.session,
});

/**
 * Start video session / ring the other participant
 */
exports.startSession = asyncHandler(async (req, res) => {
  const { appointmentId } = req.body;
  const userId = req.userId;
  const userName = req.user?.fullName || req.user?.email || 'User';

  if (!appointmentId) {
    return res.status(400).json({ success: false, message: 'Appointment ID is required' });
  }

  const result = await videoSessionService.startSession(appointmentId, userId, userName);
  res.json({ success: true, message: 'Video session started', data: serializeSessionCredentials(result) });
});

/**
 * Accept an incoming call and return the receiver's join credentials
 */
exports.acceptSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'Video call ID is required' });
  }

  const result = await videoSessionService.acceptSession(
    sessionId,
    req.userId,
    req.user?.fullName || req.user?.email || 'User'
  );
  res.json({ success: true, message: 'Video call accepted', data: serializeSessionCredentials(result) });
});

/**
 * End a ringing or active session. Idempotent by design.
 */
exports.endSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'Video call ID is required' });
  }
  const result = await videoSessionService.endSession(sessionId, req.userId);
  res.json({ success: true, message: 'Video session ended', data: result });
});

/**
 * Get session by appointment ID with a fresh token for the current participant
 */
exports.getByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const result = await videoSessionService.getSessionByAppointment(
    appointmentId,
    req.userId,
    req.user?.fullName || req.user?.email || 'User'
  );
  res.json({ success: true, message: 'OK', data: serializeSessionCredentials(result) });
});

/**
 * List calls currently ringing for the authenticated user
 */
exports.getIncoming = asyncHandler(async (req, res) => {
  const sessions = await videoSessionService.getIncomingSessions(req.userId);
  res.json({ success: true, message: 'OK', data: { sessions } });
});
