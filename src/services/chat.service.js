const ChatMessage = require('../models/chatMessage.model');
const Conversation = require('../models/conversation.model');
const User = require('../models/user.model');

/**
 * Send message
 * @param {Object} data - Message data
 * @returns {Promise<Object>} Created message
 */
const sendMessage = async (data) => {
  const { doctorId, patientId, senderId, message, attachments } = data;

  // Verify participants exist
  const [doctor, patient, sender] = await Promise.all([
    User.findById(doctorId),
    User.findById(patientId),
    User.findById(senderId)
  ]);

  if (!doctor || doctor.role !== 'DOCTOR') {
    throw new Error('Doctor not found');
  }

  if (!patient || patient.role !== 'PATIENT') {
    throw new Error('Patient not found');
  }

  if (!sender) {
    throw new Error('Sender not found');
  }

  // Verify sender is either doctor or patient
  if (senderId !== doctorId && senderId !== patientId) {
    throw new Error('Sender must be either doctor or patient');
  }

  // Get or create conversation
  let conversation = await Conversation.findOne({
    doctorId,
    patientId
  });

  if (!conversation) {
    conversation = await Conversation.create({
      doctorId,
      patientId,
      lastMessageAt: new Date()
    });
  } else {
    conversation.lastMessageAt = new Date();
    await conversation.save();
  }

  // Create message
  const chatMessage = await ChatMessage.create({
    conversationId: conversation._id,
    doctorId,
    patientId,
    senderId,
    message: message || null,
    attachments: attachments || null,
    isRead: false
  });

  return chatMessage;
};

/**
 * Get messages for conversation
 * @param {string} conversationId - Conversation ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Messages and pagination info
 */
const getMessages = async (conversationId, options = {}) => {
  const { page = 1, limit = 50 } = options;

  const conversation = await Conversation.findById(conversationId);
  
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    ChatMessage.find({ conversationId })
      .populate('senderId', 'fullName profileImage role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ChatMessage.countDocuments({ conversationId })
  ]);

  return {
    messages: messages.reverse(), // Return in chronological order
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get or create conversation between doctor and patient
 * @param {string} doctorId - Doctor ID
 * @param {string} patientId - Patient ID
 * @returns {Promise<Object>} Conversation
 */
const getOrCreateConversation = async (doctorId, patientId) => {
  let conversation = await Conversation.findOne({
    doctorId,
    patientId
  })
    .populate('doctorId', 'fullName email phone profileImage')
    .populate('patientId', 'fullName email phone profileImage');

  if (!conversation) {
    conversation = await Conversation.create({
      doctorId,
      patientId,
      lastMessageAt: new Date()
    });

    await conversation.populate('doctorId', 'fullName email phone profileImage');
    await conversation.populate('patientId', 'fullName email phone profileImage');
  }

  return conversation;
};

module.exports = {
  sendMessage,
  getMessages,
  getOrCreateConversation
};

