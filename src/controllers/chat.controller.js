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
 * Supports both doctor-patient (with appointment) and admin-doctor (without appointment) conversations
 * adminId is fetched from token if user is ADMIN
 */
exports.getOrCreateConversation = asyncHandler(async (req, res) => {
  const { doctorId, patientId, appointmentId } = req.body;
  // Fetch adminId from token if user is ADMIN
  const adminId = req.userRole === 'ADMIN' ? req.userId : req.body.adminId;
  const result = await chatService.getOrCreateConversation(doctorId, patientId, adminId, appointmentId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get conversations for current user (admin or doctor)
 */
exports.getConversations = asyncHandler(async (req, res) => {
  const result = await chatService.getConversations(req.userId, req.userRole, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Mark messages as read in a conversation
 */
exports.markMessagesAsRead = asyncHandler(async (req, res) => {
  const result = await chatService.markMessagesAsRead(req.params.conversationId, req.userId);
  res.json({ success: true, message: 'Messages marked as read', data: result });
});

/**
 * Get unread message count for current user
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const result = await chatService.getUnreadCount(req.userId, req.userRole);
  res.json({ success: true, message: 'OK', data: { unreadCount: result } });
});

