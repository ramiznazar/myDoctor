const asyncHandler = require('../middleware/asyncHandler');
const authService = require('../services/auth.service');

/**
 * Register user (DOCTOR or PATIENT)
 */
exports.register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Login user
 */
exports.login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);
  
  // If there's a message (e.g., pending approval), include it in the response message
  const message = result.message || 'OK';
  
  res.json({ 
    success: true, 
    message: message, 
    data: result 
  });
});

/**
 * Approve doctor (admin only)
 */
exports.approveDoctor = asyncHandler(async (req, res) => {
  const result = await authService.approveDoctor(req.body.doctorId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Change password
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.userId, oldPassword, newPassword);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Refresh token
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshToken(req.body.refreshToken);
  res.json({ success: true, message: 'OK', data: result });
});
