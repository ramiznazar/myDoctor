const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const {
  registerValidator,
  loginValidator,
  adminApproveDoctorValidator,
  changePasswordValidator,
  refreshTokenValidator
} = require('../validators/auth.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

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

module.exports = router;
