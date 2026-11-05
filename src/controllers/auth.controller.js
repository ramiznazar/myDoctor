const asyncHandler = require('../middleware/asyncHandler');
const authService = require('../services/auth.service');

/**
 * Register user (DOCTOR or PATIENT)
 */
exports.register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  res.json({ success: true, message: result.requiresEmailVerification ? 'Verification code sent to your email address' : 'OK', data: result });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const result = await authService.verifyEmail(req.body.email, req.body.code);
  res.json({ success: true, message: 'Email verified successfully', data: result });
});

exports.resendEmailVerification = asyncHandler(async (req, res) => {
  await authService.resendEmailVerification(req.body.email);
  res.json({ success: true, message: 'If this account is awaiting verification, a new code has been sent.' });
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
 * Approve pharmacy (admin only)
 */
exports.approvePharmacy = asyncHandler(async (req, res) => {
  const result = await authService.approvePharmacy(req.body.pharmacyUserId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Change password
 */
exports.changePassword = asyncHandler(async (req, res) => {
  const { newPassword, code } = req.body;
  const result = await authService.changePassword(req.userId, newPassword, code);
  res.json({ success: true, message: 'OK', data: result });
});

exports.requestChangePasswordCode = asyncHandler(async (req, res) => {
  await authService.requestChangePasswordCode(req.userId);
  res.json({ success: true, message: 'Verification code sent to your registered email address.' });
});

exports.verifyChangePasswordCode = asyncHandler(async (req, res) => {
  const result = await authService.verifyChangePasswordCode(req.userId, req.body.code);
  res.json({ success: true, message: 'Verification code confirmed.', data: result });
});

/**
 * Refresh token
 */
exports.refreshToken = asyncHandler(async (req, res) => {
  const result = await authService.refreshToken(req.body.refreshToken);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Request password reset - Send OTP
 */
exports.requestPasswordReset = asyncHandler(async (req, res) => {
  const result = await authService.requestPasswordReset(req.body.email);
  res.json({ success: true, message: result.message });
});

/**
 * Verify password reset code
 */
exports.verifyPasswordResetCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  const result = await authService.verifyPasswordResetCode(email, code);
  res.json({ success: true, message: result.message, data: result });
});

/**
 * Reset password
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;
  const result = await authService.resetPassword(email, code, newPassword);
  res.json({ success: true, message: result.message });
});

exports.sendPhoneOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body || {};
  const result = await authService.sendPhoneOtpForUser(req.userId, phone);
  res.json({ success: true, message: 'OK', data: result });
});

exports.verifyPhoneOtp = asyncHandler(async (req, res) => {
  const { code, phone } = req.body || {};
  const result = await authService.verifyPhoneOtpForUser(req.userId, code, phone);
  res.json({ success: true, message: 'OK', data: result });
});
