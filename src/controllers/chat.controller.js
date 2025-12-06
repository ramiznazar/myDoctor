const asyncHandler = require('../middleware/asyncHandler');
const chatService = require('../services/chat.service');

/**
 * Send message
 */
exports.sendMessage = asyncHandler(async (req, res) => {
  const messageData = {
    ...req.body,
    senderId: req.userId
  };
  const result = await chatService.sendMessage(messageData);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get messages for conversation
 */
exports.getMessages = asyncHandler(async (req, res) => {
  const result = await chatService.getMessages(req.params.conversationId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get or create conversation
 */
exports.getOrCreateConversation = asyncHandler(async (req, res) => {
  const result = await chatService.getOrCreateConversation(req.body.doctorId, req.body.patientId);
  res.json({ success: true, message: 'OK', data: result });
});

