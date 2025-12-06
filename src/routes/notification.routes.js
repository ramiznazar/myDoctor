const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const {
  createNotificationValidator,
  markNotificationReadValidator,
  getNotificationsValidator
} = require('../validators/notification.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/notification
 * @desc    Create notification
 * @access  Private (Admin/System)
 */
router.post(
  '/',
  authGuard(['ADMIN']),
  validate(createNotificationValidator),
  asyncHandler(notificationController.create)
);

/**
 * @route   PUT /api/notification/read/:id
 * @desc    Mark notification as read
 * @access  Private
 */
router.put(
  '/read/:id',
  authGuard([]),
  validate(markNotificationReadValidator),
  asyncHandler(notificationController.markRead)
);

/**
 * @route   GET /api/notification/:userId
 * @desc    List notifications for user
 * @access  Private
 */
router.get(
  '/:userId',
  authGuard([]),
  validate(getNotificationsValidator),
  asyncHandler(notificationController.list)
);

module.exports = router;

