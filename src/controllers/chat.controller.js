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

  // Never trust participant IDs supplied by the browser. Bind them to the
  // authenticated user's role so one user cannot post as another.
  if (req.userRole === 'PATIENT') {
    messageData.patientId = req.userId;
  } else if (req.userRole === 'DOCTOR') {
    messageData.doctorId = req.userId;
  } else if (req.userRole === 'ADMIN') {
    messageData.adminId = req.userId;
  }

  const result = await chatService.sendMessage(messageData);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get messages for conversation
 */
exports.getMessages = asyncHandler(async (req, res) => {
  const result = await chatService.getMessages(req.params.conversationId, req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get or create conversation
 * Supports both doctor-patient (with appointment) and admin-doctor (without appointment) conversations
 * adminId is fetched from token if user is ADMIN
 */
exports.getOrCreateConversation = asyncHandler(async (req, res) => {
  const { doctorId, patientId, appointmentId } = req.body;
  const adminId = req.userRole === 'ADMIN' ? req.userId : req.body.adminId;
  const actorId = req.userId;
  const resolvedPatientId = req.userRole === 'PATIENT' ? req.userId : patientId;
  const resolvedDoctorId = req.userRole === 'DOCTOR' ? req.userId : doctorId;

  const result = await chatService.getOrCreateConversation(
    resolvedDoctorId,
    resolvedPatientId,
    adminId,
    appointmentId,
    actorId
  );
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get conversations for current user (admin, doctor or patient)
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

/**
 * Mark a doctor-patient conversation as completed (doctor only)
 */
exports.markConversationComplete = asyncHandler(async (req, res) => {
  const result = await chatService.markConversationComplete(req.params.conversationId, req.userId);
  res.json({ success: true, message: 'Conversation marked as completed', data: result });
});

exports.getOrCreateAdminSupportConversation = asyncHandler(async (req, res) => {
  const result = await chatService.getOrCreateAdminSupportConversation(req.userId, req.userRole, req.body?.userId);
  res.json({ success: true, message: 'OK', data: result });
});

exports.sendAdminSupportMessage = asyncHandler(async (req, res) => {
  const result = await chatService.sendAdminSupportMessage({
    conversationId: req.params.conversationId,
    senderId: req.userId,
    message: req.body?.message,
    attachments: req.body?.attachments,
  });
  res.json({ success: true, message: 'OK', data: result });
});
