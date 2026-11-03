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

/**
 * @route   POST /api/chat/send
 * @desc    Send message
 *         - Doctor-Patient: chat opens at appointment start and is blocked
 *           after the doctor marks the conversation as completed
 *         - Admin-Doctor: no appointment required, always available
 * @access  Private
 */
router.post(
  '/send',
  authGuard([]),
  validate(sendMessageValidator),
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
 * @desc    Get all conversations for current user (admin, doctor or patient)
 * @access  Private (Admin/Doctor/Patient)
 */
router.get(
  '/conversations',
  authGuard(['ADMIN', 'DOCTOR', 'PATIENT']),
  asyncHandler(chatController.getConversations)
);

/**
 * @route   POST /api/chat/conversation
 * @desc    Get or create conversation
 *         - Doctor-Patient: requires a confirmed appointment and the
 *           appointment start time to have been reached
 *         - Admin-Doctor: no appointment required, always available
 * @access  Private
 */
router.post(
  '/conversation',
  authGuard([]),
  validate(createOrGetConversationValidator),
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
 * @route   POST /api/chat/conversations/:conversationId/complete
 * @desc    Mark a doctor-patient conversation as completed (doctor only)
 * @access  Private (Doctor)
 */
router.post(
  '/conversations/:conversationId/complete',
  authGuard(['DOCTOR']),
  asyncHandler(chatController.markConversationComplete)
);

/**
 * @route   GET /api/chat/unread-count
 * @desc    Get unread message count for current user
 * @access  Private (Admin/Doctor/Patient)
 */
router.get(
  '/unread-count',
  authGuard(['ADMIN', 'DOCTOR', 'PATIENT']),
  asyncHandler(chatController.getUnreadCount)
);

module.exports = router;
