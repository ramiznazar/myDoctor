const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const {
  sendMessageValidator,
  getConversationMessagesValidator,
  createOrGetConversationValidator
} = require('../validators/chat.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAppointmentAccess } = require('../middleware/appointmentAccess');

/**
 * @route   POST /api/chat/send
 * @desc    Send message
 *         - Doctor-Patient: requires confirmed appointment and appointment time must have started
 *         - Admin-Doctor: no appointment required, always available
 * @access  Private
 */
router.post(
  '/send',
  authGuard([]),
  validate(sendMessageValidator),
  asyncHandler((req, res, next) => {
    // Only apply appointment access check for doctor-patient conversations
    if (req.body.patientId && req.body.appointmentId) {
      return requireAppointmentAccess(req, res, next);
    }
    // Skip appointment check for admin-doctor conversations
    next();
  }),
  asyncHandler(chatController.sendMessage)
);

/**
 * @route   GET /api/chat/messages/:conversationId
 * @desc    Get messages for conversation
 * @access  Private
 */
router.get(
  '/messages/:conversationId',
  authGuard([]),
  validate(getConversationMessagesValidator),
  asyncHandler(chatController.getMessages)
);

/**
 * @route   GET /api/chat/conversations
 * @desc    Get all conversations for current user (admin or doctor)
 * @access  Private (Admin/Doctor)
 */
router.get(
  '/conversations',
  authGuard(['ADMIN', 'DOCTOR']),
  asyncHandler(chatController.getConversations)
);

/**
 * @route   POST /api/chat/conversation
 * @desc    Get or create conversation
 *         - Doctor-Patient: requires confirmed appointment and appointment time must have started
 *         - Admin-Doctor: no appointment required, always available
 * @access  Private
 */
router.post(
  '/conversation',
  authGuard([]),
  validate(createOrGetConversationValidator),
  asyncHandler((req, res, next) => {
    // Only apply appointment access check for doctor-patient conversations
    if (req.body.patientId && req.body.appointmentId) {
      return requireAppointmentAccess(req, res, next);
    }
    // Skip appointment check for admin-doctor conversations
    next();
  }),
  asyncHandler(chatController.getOrCreateConversation)
);

/**
 * @route   PUT /api/chat/conversations/:conversationId/read
 * @desc    Mark all messages in conversation as read
 * @access  Private
 */
router.put(
  '/conversations/:conversationId/read',
  authGuard([]),
  asyncHandler(chatController.markMessagesAsRead)
);

/**
 * @route   GET /api/chat/unread-count
 * @desc    Get unread message count for current user
 * @access  Private (Admin/Doctor)
 */
router.get(
  '/unread-count',
  authGuard(['ADMIN', 'DOCTOR']),
  asyncHandler(chatController.getUnreadCount)
);

module.exports = router;

