const asyncHandler = require('../middleware/asyncHandler');
const notificationService = require('../services/notification.service');

/**
 * Create notification
 */
exports.create = asyncHandler(async (req, res) => {
  const result = await notificationService.createNotification(req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Mark notification as read
 */
exports.markRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markNotificationRead(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List notifications for current user (from token)
 */
exports.list = asyncHandler(async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID is required' });
  }
  const result = await notificationService.listNotifications(userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

