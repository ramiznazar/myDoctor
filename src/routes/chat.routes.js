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
 * @route   POST /api/chat/conversation
 * @desc    Get or create conversation
 * @access  Private
 */
router.post(
  '/conversation',
  authGuard([]),
  validate(createOrGetConversationValidator),
  asyncHandler(chatController.getOrCreateConversation)
);

module.exports = router;

