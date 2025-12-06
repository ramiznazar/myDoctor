const asyncHandler = require('../middleware/asyncHandler');
const videoSessionService = require('../services/videoSession.service');

/**
 * Start video session
 */
exports.startSession = asyncHandler(async (req, res) => {
  const result = await videoSessionService.startSession(req.body.appointmentId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * End video session
 */
exports.endSession = asyncHandler(async (req, res) => {
  const result = await videoSessionService.endSession(req.body.sessionId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get session by appointment ID
 */
exports.getByAppointment = asyncHandler(async (req, res) => {
  const result = await videoSessionService.getSessionByAppointment(req.params.appointmentId);
  res.json({ success: true, message: 'OK', data: result });
});

