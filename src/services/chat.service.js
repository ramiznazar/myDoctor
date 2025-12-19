const ChatMessage = require('../models/chatMessage.model');
const Conversation = require('../models/conversation.model');
const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Notification = require('../models/notification.model');
const { isAppointmentTimeStarted } = require('../middleware/appointmentAccess');

/**
 * Send message
 * Supports both doctor-patient (with appointment) and admin-doctor (without appointment) conversations
 * @param {Object} data - Message data
 * @returns {Promise<Object>} Created message
 */
const sendMessage = async (data) => {
  const { doctorId, patientId, adminId, senderId, message, attachments, appointmentId } = data;

  // Determine conversation type
  const isAdminDoctorChat = !!adminId;
  const isDoctorPatientChat = !!patientId && !!appointmentId;

  if (!isAdminDoctorChat && !isDoctorPatientChat) {
    throw new Error('Either admin-doctor or doctor-patient conversation must be specified');
  }

  // Verify sender exists
  const sender = await User.findById(senderId);
  if (!sender) {
    throw new Error('Sender not found');
  }

  if (isAdminDoctorChat) {
    // Admin-Doctor conversation (no appointment required)
    const [admin, doctor] = await Promise.all([
      User.findById(adminId),
      User.findById(doctorId)
    ]);

    if (!admin || admin.role !== 'ADMIN') {
      throw new Error('Admin not found');
    }

    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new Error('Doctor not found');
    }

    // Verify sender is either admin or doctor
    if (senderId !== adminId && senderId !== doctorId) {
      throw new Error('Sender must be either admin or doctor');
    }

    // Get or create admin-doctor conversation
    let conversation = await Conversation.findOne({
      adminId,
      doctorId,
      conversationType: 'ADMIN_DOCTOR'
    });

    if (!conversation) {
      conversation = await Conversation.create({
        adminId,
        doctorId,
        conversationType: 'ADMIN_DOCTOR',
        lastMessageAt: new Date()
      });
    } else {
      conversation.lastMessageAt = new Date();
      await conversation.save();
    }

    // Check if doctor account is inactive
    if (doctor.status !== 'APPROVED') {
      throw new Error(`Doctor account is ${doctor.status.toLowerCase()}. Cannot send message to inactive doctor.`);
    }

    // Create message
    const chatMessage = await ChatMessage.create({
      conversationId: conversation._id,
      adminId,
      doctorId,
      senderId,
      message: message || null,
      attachments: attachments || null,
      isRead: false
    });

    // Send notification to doctor if admin sent the message
    if (senderId === adminId) {
      try {
        await Notification.create({
          userId: doctorId,
          title: 'New Message from Admin',
          body: message ? (message.length > 100 ? message.substring(0, 100) + '...' : message) : 'You have a new message',
          type: 'CHAT',
          data: {
            conversationId: conversation._id.toString(),
            messageId: chatMessage._id.toString(),
            senderId: adminId.toString()
          },
          isRead: false
        });
      } catch (notificationError) {
        // Log error but don't fail the message send
        console.error('Failed to create notification:', notificationError);
      }
    }

    return chatMessage;
  } else {
    // Doctor-Patient conversation (requires appointment)
    const [doctor, patient] = await Promise.all([
      User.findById(doctorId),
      User.findById(patientId)
    ]);

    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new Error('Doctor not found');
    }

    if (!patient || patient.role !== 'PATIENT') {
      throw new Error('Patient not found');
    }

    // Verify sender is either doctor or patient
    if (senderId !== doctorId && senderId !== patientId) {
      throw new Error('Sender must be either doctor or patient');
    }

    // REQUIRED: Check appointment access
    if (!appointmentId) {
      throw new Error('Appointment ID is required for doctor-patient communication');
    }

    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      throw new Error('Appointment not found');
    }

    // Verify appointment belongs to this doctor and patient
    if (appointment.doctorId.toString() !== doctorId || appointment.patientId.toString() !== patientId) {
      throw new Error('Appointment does not match the provided doctor and patient');
    }

    // Check appointment status - must be CONFIRMED
    if (appointment.status !== 'CONFIRMED') {
      const statusMessages = {
        'PENDING': 'Appointment is pending doctor acceptance. Communication will be available after the doctor accepts the appointment.',
        'REJECTED': 'This appointment was rejected. Communication is not available.',
        'CANCELLED': 'This appointment was cancelled. Communication is not available.',
        'COMPLETED': 'This appointment has been completed. Communication is no longer available.',
        'NO_SHOW': 'This appointment was marked as no-show. Communication is not available.'
      };
      throw new Error(statusMessages[appointment.status] || 'Communication is not available for this appointment status.');
    }

    // Check if appointment time has started
    if (!isAppointmentTimeStarted(appointment.appointmentDate, appointment.appointmentTime)) {
      const appointmentDateTime = new Date(appointment.appointmentDate);
      const [hours, minutes] = appointment.appointmentTime.split(':').map(Number);
      appointmentDateTime.setHours(hours, minutes, 0, 0);
      throw new Error(`Communication is only available at the scheduled appointment time. Your appointment is scheduled for ${appointmentDateTime.toLocaleString()}.`);
    }

    // Get or create conversation (link to appointment)
    let conversation = await Conversation.findOne({
      doctorId,
      patientId,
      appointmentId: appointment._id,
      conversationType: 'DOCTOR_PATIENT'
    });

    if (!conversation) {
      conversation = await Conversation.create({
        doctorId,
        patientId,
        appointmentId: appointment._id,
        conversationType: 'DOCTOR_PATIENT',
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
      appointmentId: appointment._id,
      message: message || null,
      attachments: attachments || null,
      isRead: false
    });

    return chatMessage;
  }
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
 * Get or create conversation
 * Supports both doctor-patient (with appointment) and admin-doctor (without appointment) conversations
 * @param {string} doctorId - Doctor ID
 * @param {string} patientId - Patient ID (optional, for doctor-patient)
 * @param {string} adminId - Admin ID (optional, for admin-doctor - can be from token)
 * @param {string} appointmentId - Appointment ID (required for doctor-patient, optional for admin-doctor)
 * @returns {Promise<Object>} Conversation
 */
const getOrCreateConversation = async (doctorId, patientId, adminId, appointmentId) => {
  // Determine conversation type
  const isAdminDoctorChat = !!adminId;
  const isDoctorPatientChat = !!patientId && !!appointmentId;

  if (!isAdminDoctorChat && !isDoctorPatientChat) {
    throw new Error('Either admin-doctor or doctor-patient conversation must be specified');
  }

  if (isAdminDoctorChat) {
    // Admin-Doctor conversation (no appointment required)
    const [admin, doctor] = await Promise.all([
      User.findById(adminId),
      User.findById(doctorId)
    ]);

    if (!admin || admin.role !== 'ADMIN') {
      const error = new Error('Admin not found');
      error.statusCode = 404;
      throw error;
    }

    if (!doctor || doctor.role !== 'DOCTOR') {
      const error = new Error('Doctor not found');
      error.statusCode = 404;
      throw error;
    }

    let conversation = await Conversation.findOne({
      adminId,
      doctorId,
      conversationType: 'ADMIN_DOCTOR'
    })
      .populate('adminId', 'fullName email phone profileImage')
      .populate('doctorId', 'fullName email phone profileImage');

    if (!conversation) {
      conversation = await Conversation.create({
        adminId,
        doctorId,
        conversationType: 'ADMIN_DOCTOR',
        lastMessageAt: new Date()
      });

      await conversation.populate('adminId', 'fullName email phone profileImage');
      await conversation.populate('doctorId', 'fullName email phone profileImage');
    }

    return conversation;
  } else {
    // Doctor-Patient conversation (requires appointment)
    if (!appointmentId) {
      throw new Error('Appointment ID is required for doctor-patient conversation');
    }

    // Verify appointment exists and is confirmed
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      const error = new Error('Appointment not found');
      error.statusCode = 404;
      throw error;
    }

    if (appointment.status !== 'CONFIRMED') {
      throw new Error('Appointment must be confirmed before communication can begin');
    }

    // Check if appointment time has started
    if (!isAppointmentTimeStarted(appointment.appointmentDate, appointment.appointmentTime)) {
      const appointmentDateTime = new Date(appointment.appointmentDate);
      const [hours, minutes] = appointment.appointmentTime.split(':').map(Number);
      appointmentDateTime.setHours(hours, minutes, 0, 0);
      throw new Error(`Communication is only available at the scheduled appointment time. Your appointment is scheduled for ${appointmentDateTime.toLocaleString()}.`);
    }

    let conversation = await Conversation.findOne({
      doctorId,
      patientId,
      appointmentId: appointment._id,
      conversationType: 'DOCTOR_PATIENT'
    })
      .populate('doctorId', 'fullName email phone profileImage')
      .populate('patientId', 'fullName email phone profileImage')
      .populate('appointmentId', 'appointmentDate appointmentTime status');

    if (!conversation) {
      conversation = await Conversation.create({
        doctorId,
        patientId,
        appointmentId: appointment._id,
        conversationType: 'DOCTOR_PATIENT',
        lastMessageAt: new Date()
      });

      await conversation.populate('doctorId', 'fullName email phone profileImage');
      await conversation.populate('patientId', 'fullName email phone profileImage');
      await conversation.populate('appointmentId', 'appointmentDate appointmentTime status');
    }

    return conversation;
  }
};

/**
 * Get conversations for a user (admin or doctor)
 * @param {string} userId - User ID
 * @param {string} userRole - User role (ADMIN or DOCTOR)
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Conversations and pagination info
 */
const getConversations = async (userId, userRole, options = {}) => {
  const { page = 1, limit = 20 } = options;

  let query = {};

  if (userRole === 'ADMIN') {
    query = { adminId: userId, conversationType: 'ADMIN_DOCTOR' };
  } else if (userRole === 'DOCTOR') {
    // Doctor can see both admin-doctor and doctor-patient conversations
    query = {
      $or: [
        { doctorId: userId, conversationType: 'ADMIN_DOCTOR' },
        { doctorId: userId, conversationType: 'DOCTOR_PATIENT' }
      ]
    };
  } else {
    throw new Error('Invalid role. Only ADMIN and DOCTOR can list conversations.');
  }

  const skip = (page - 1) * limit;

  const [conversations, total] = await Promise.all([
    Conversation.find(query)
      .populate('adminId', 'fullName email phone profileImage')
      .populate('doctorId', 'fullName email phone profileImage')
      .populate('patientId', 'fullName email phone profileImage')
      .populate('appointmentId', 'appointmentDate appointmentTime status')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit),
    Conversation.countDocuments(query)
  ]);

  // Add unread message counts for each conversation
  const conversationsWithUnread = await Promise.all(
    conversations.map(async (conversation) => {
      const conversationObj = conversation.toObject();
      
      // Count unread messages for the current user
      const unreadQuery = {
        conversationId: conversation._id,
        isRead: false
      };
      
      if (userRole === 'ADMIN') {
        // Admin sees unread messages they haven't read (messages not sent by admin)
        unreadQuery.senderId = { $ne: userId };
      } else if (userRole === 'DOCTOR' && conversation.conversationType === 'ADMIN_DOCTOR') {
        // Doctor sees unread messages they haven't read (messages not sent by doctor)
        unreadQuery.senderId = { $ne: userId };
      } else if (userRole === 'DOCTOR' && conversation.conversationType === 'DOCTOR_PATIENT') {
        // For doctor-patient, count messages not sent by doctor
        unreadQuery.senderId = { $ne: userId };
      }
      
      const unreadCount = await ChatMessage.countDocuments(unreadQuery);
      conversationObj.unreadCount = unreadCount;
      
      return conversationObj;
    })
  );

  return {
    conversations: conversationsWithUnread,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Mark messages as read in a conversation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID marking messages as read
 * @returns {Promise<Object>} Updated count
 */
const markMessagesAsRead = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Mark all messages not sent by this user as read
  const result = await ChatMessage.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      isRead: false
    },
    {
      $set: { isRead: true }
    }
  );

  return { updatedCount: result.modifiedCount };
};

/**
 * Get unread message count for a user
 * @param {string} userId - User ID
 * @param {string} userRole - User role (ADMIN or DOCTOR)
 * @returns {Promise<number>} Unread message count
 */
const getUnreadCount = async (userId, userRole) => {
  let query = {};

  if (userRole === 'ADMIN') {
    query = {
      adminId: userId,
      conversationType: 'ADMIN_DOCTOR',
      isRead: false,
      senderId: { $ne: userId }
    };
  } else if (userRole === 'DOCTOR') {
    query = {
      $or: [
        { doctorId: userId, conversationType: 'ADMIN_DOCTOR' },
        { doctorId: userId, conversationType: 'DOCTOR_PATIENT' }
      ],
      isRead: false,
      senderId: { $ne: userId }
    };
  } else {
    return 0;
  }

  return await ChatMessage.countDocuments(query);
};

module.exports = {
  sendMessage,
  getMessages,
  getOrCreateConversation,
  getConversations,
  markMessagesAsRead,
  getUnreadCount
};

