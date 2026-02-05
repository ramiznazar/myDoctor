const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const { normalizeLang, localizeNotification } = require('../utils/localization');

/**
 * Create notification
 * @param {Object} data - Notification data
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async (data) => {
  const { userId, title, body, i18n, type, data: notificationData } = data;

  // Verify user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const notification = await Notification.create({
    userId,
    title,
    body,
    i18n,
    type: type || 'SYSTEM',
    data: notificationData || null,
    isRead: false
  });

  return notification;
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (to verify ownership)
 * @returns {Promise<Object>} Updated notification
 */
const markNotificationRead = async (notificationId, userId = null) => {
  const notification = await Notification.findById(notificationId);
  
  if (!notification) {
    throw new Error('Notification not found');
  }

  // Verify ownership if userId is provided
  if (userId && notification.userId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: Notification does not belong to this user');
  }

  notification.isRead = true;
  await notification.save();

  return notification;
};

/**
 * List notifications for user
 * @param {string} userId - User ID
 * @param {Object} options - Filter and pagination options
 * @returns {Promise<Object>} Notifications and pagination info
 */
const listNotifications = async (userId, options = {}) => {
  const {
    type,
    isRead,
    page = 1,
    limit = 20
  } = options;

  const lang = normalizeLang(options.lang);

  const query = { userId };

  if (type) {
    query.type = type.toUpperCase();
  }

  if (isRead !== undefined) {
    query.isRead = isRead === true || isRead === 'true';
  }

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Notification.countDocuments(query)
  ]);

  const localizedNotifications = lang ? notifications.map((n) => localizeNotification(n, lang)) : notifications;

  return {
    notifications: localizedNotifications,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  createNotification,
  markNotificationRead,
  listNotifications
};

