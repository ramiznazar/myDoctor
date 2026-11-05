const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const {
  registerValidator,
  loginValidator,
  adminApproveDoctorValidator,
  adminApprovePharmacyValidator,
  changePasswordValidator,
  verificationEmailValidator,
  verifyEmailValidator,
  changePasswordCodeValidator,
  refreshTokenValidator,
  requestPasswordResetValidator,
  verifyPasswordResetCodeValidator,
  resetPasswordValidator,
  sendPhoneOtpValidator,
  verifyPhoneOtpValidator
} = require('../validators/auth.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

const limitMessage = 'Troppi tentativi. Attendi qualche minuto prima di riprovare.';
const codeDeliveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: limitMessage },
});
const codeVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: limitMessage },
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user (DOCTOR or PATIENT)
 * @access  Public
 */
router.post(
  '/register',
  validate(registerValidator),
  asyncHandler(authController.register)
);

router.post('/verify-email', codeVerificationLimiter, validate(verifyEmailValidator), asyncHandler(authController.verifyEmail));
router.post('/resend-email-verification', codeDeliveryLimiter, validate(verificationEmailValidator), asyncHandler(authController.resendEmailVerification));

router.post(
  '/phone-otp/send',
  authGuard(['PHARMACY', 'PARAPHARMACY']),
  validate(sendPhoneOtpValidator),
  asyncHandler(authController.sendPhoneOtp)
);

router.post(
  '/phone-otp/verify',
  authGuard(['PHARMACY', 'PARAPHARMACY']),
  validate(verifyPhoneOtpValidator),
  asyncHandler(authController.verifyPhoneOtp)
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  validate(loginValidator),
  asyncHandler(authController.login)
);

/**
 * @route   POST /api/auth/approve-doctor
 * @desc    Approve doctor (admin only)
 * @access  Private (Admin)
 */
router.post(
  '/approve-doctor',
  authGuard(['ADMIN']),
  validate(adminApproveDoctorValidator),
  asyncHandler(authController.approveDoctor)
);

router.post(
  '/approve-pharmacy',
  authGuard(['ADMIN']),
  validate(adminApprovePharmacyValidator),
  asyncHandler(authController.approvePharmacy)
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  authGuard([]),
  validate(changePasswordValidator),
  asyncHandler(authController.changePassword)
);

router.post('/change-password/request-code', codeDeliveryLimiter, authGuard([]), asyncHandler(authController.requestChangePasswordCode));
router.post('/change-password/verify-code', codeVerificationLimiter, authGuard([]), validate(changePasswordCodeValidator), asyncHandler(authController.verifyChangePasswordCode));

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh JWT token
 * @access  Public
 */
router.post(
  '/refresh-token',
  validate(refreshTokenValidator),
  asyncHandler(authController.refreshToken)
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset - Send OTP to email
 * @access  Public
 */
router.post(
  '/forgot-password',
  codeDeliveryLimiter,
  validate(requestPasswordResetValidator),
  asyncHandler(authController.requestPasswordReset)
);

/**
 * @route   POST /api/auth/verify-reset-code
 * @desc    Verify password reset OTP code
 * @access  Public
 */
router.post(
  '/verify-reset-code',
  codeVerificationLimiter,
  validate(verifyPasswordResetCodeValidator),
  asyncHandler(authController.verifyPasswordResetCode)
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with verified code
 * @access  Public
 */
router.post(
  '/reset-password',
  validate(resetPasswordValidator),
  asyncHandler(authController.resetPassword)
);

module.exports = router;
