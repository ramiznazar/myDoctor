const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const {
  updateUserProfileValidator,
  updateUserStatusValidator
} = require('../validators/user.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get(
  '/:id',
  authGuard([]),
  asyncHandler(userController.getUserById)
);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  authGuard([]),
  validate(updateUserProfileValidator),
  asyncHandler(userController.updateProfile)
);

/**
 * @route   PUT /api/users/status/:id
 * @desc    Update user status (admin only)
 * @access  Private (Admin)
 */
router.put(
  '/status/:id',
  authGuard(['ADMIN']),
  validate(updateUserStatusValidator),
  asyncHandler(userController.updateStatus)
);

/**
 * @route   GET /api/users
 * @desc    List users with filtering
 * @access  Private (Admin)
 */
router.get(
  '/',
  authGuard(['ADMIN']),
  asyncHandler(userController.listUsers)
);

module.exports = router;
