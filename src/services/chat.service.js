const ChatMessage = require('../models/chatMessage.model');
const Conversation = require('../models/conversation.model');
const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Notification = require('../models/notification.model');
const mongoose = require('mongoose');
const subscriptionPolicy = require('./subscriptionPolicy.service');
const { getAppointmentStart } = require('../utils/appointmentTime');

const sameId = (left, right) => String(left || '') === String(right || '');

const getId = (value) => (value?._id || value)?.toString?.() || String(value || '');

const relationshipKeyFor = (doctorId, patientId) =>
  `DOCTOR_PATIENT:${getId(doctorId)}:${getId(patientId)}`;

const isDuplicateKeyError = (error, field) => error?.code === 11000 && Boolean(error?.keyPattern?.[field]);

const ensureRelationshipKey = async (conversation, doctorId, patientId) => {
  if (!conversation) return null;
  const relationshipKey = relationshipKeyFor(doctorId, patientId);
  if (conversation.relationshipKey === relationshipKey) return conversation;

  conversation.relationshipKey = relationshipKey;
  try {
    await conversation.save();
    return conversation;
  } catch (error) {
    if (!isDuplicateKeyError(error, 'relationshipKey')) throw error;
    // Another request created the canonical conversation first. Reuse it
    // rather than leaking a duplicate relationship chat into the UI.
    return Conversation.findOne({ relationshipKey, mergedInto: null });
  }
};

/**
 * A doctor-patient chat opens exactly at the appointment start and stays open
 * until the assigned doctor explicitly marks the conversation as completed.
 */
const assertAppointmentChatHasStarted = (appointment) => {
  const start = getAppointmentStart(appointment);
  if (new Date() < start) {
    throw new Error('Chat will be available when the appointment time starts.');
  }
};

const normalizeChatAttachments = (items) => (Array.isArray(items) ? items : [])
  .map((attachment) => {
    if (!attachment || typeof attachment !== 'object') return null;
    const url = String(attachment.url || attachment.fileUrl || '').trim();
    if (!url) return null;
    const rawType = String(attachment.type || '').trim().toLowerCase();
    return {
      type: rawType === 'image' ? 'image' : 'file',
      url,
    };
  })
  .filter(Boolean);

const assertConversationParticipant = (conversation, userId) => {
  const participantIds = [conversation.doctorId, conversation.patientId, conversation.adminId]
    .filter(Boolean)
    .map((id) => getId(id));

  if (!participantIds.includes(getId(userId))) {
    const error = new Error('You do not have access to this conversation');
    error.statusCode = 403;
    throw error;
  }
};

const resolveMergedConversation = async (conversation) => {
  let resolvedConversation = conversation;
  const visitedConversationIds = new Set();

  while (resolvedConversation?.mergedInto) {
    const currentId = String(resolvedConversation._id);
    if (visitedConversationIds.has(currentId)) {
      throw new Error('Conversation merge chain is invalid');
    }
    visitedConversationIds.add(currentId);
    resolvedConversation = await Conversation.findById(resolvedConversation.mergedInto);
  }

  return resolvedConversation;
};

/**
 * A doctor and patient have one continuous relationship conversation. Older
 * appointment-specific records are soft-merged so their messages remain in
 * the current chat without leaving duplicate rows in the chat list.
 */
const consolidateDoctorPatientConversations = async (doctorId, patientId, preferredAppointmentId = null) => {
  const conversations = await Conversation.find({
    doctorId,
    patientId,
    conversationType: 'DOCTOR_PATIENT',
    mergedInto: null
  }).sort({ lastMessageAt: -1, updatedAt: -1 });

  if (conversations.length === 0) {
    return Conversation.findOne({
      relationshipKey: relationshipKeyFor(doctorId, patientId),
      mergedInto: null,
    });
  }

  const canonicalConversation =
    conversations.find((conversation) => preferredAppointmentId && sameId(conversation.appointmentId, preferredAppointmentId)) ||
    conversations.find((conversation) => conversation.status !== 'COMPLETED') ||
    conversations[0];

  const duplicateConversations = conversations.filter((conversation) => !sameId(conversation._id, canonicalConversation._id));
  if (duplicateConversations.length === 0) {
    return ensureRelationshipKey(canonicalConversation, doctorId, patientId);
  }

  const newestConversation = conversations.reduce((newest, conversation) => {
    const newestTime = newest?.lastMessageAt ? new Date(newest.lastMessageAt).getTime() : 0;
    const candidateTime = conversation.lastMessageAt ? new Date(conversation.lastMessageAt).getTime() : 0;
    return candidateTime > newestTime ? conversation : newest;
  }, canonicalConversation);

  const duplicateIds = duplicateConversations.map((conversation) => conversation._id);
  await ChatMessage.updateMany(
    { conversationId: { $in: duplicateIds } },
    { $set: { conversationId: canonicalConversation._id } }
  );
  await Conversation.updateMany(
    { _id: { $in: duplicateIds } },
    { $set: { mergedInto: canonicalConversation._id } }
  );

  if (newestConversation.lastMessageAt &&
      (!canonicalConversation.lastMessageAt || new Date(newestConversation.lastMessageAt) > new Date(canonicalConversation.lastMessageAt))) {
    canonicalConversation.lastMessageAt = newestConversation.lastMessageAt;
    canonicalConversation.lastMessage = newestConversation.lastMessage;
    await canonicalConversation.save();
  }

  return ensureRelationshipKey(canonicalConversation, doctorId, patientId);
};

const consolidateLegacyConversationsForUser = async (userId, userRole) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  if (!['DOCTOR', 'PATIENT'].includes(userRole)) return;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const userMatch = userRole === 'DOCTOR'
    ? { doctorId: userObjectId }
    : { patientId: userObjectId };

  const duplicateRelationships = await Conversation.aggregate([
    {
      $match: {
        ...userMatch,
        conversationType: 'DOCTOR_PATIENT',
        mergedInto: null
      }
    },
    {
      $group: {
        _id: { doctorId: '$doctorId', patientId: '$patientId' },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: 50 }
  ]).option({ maxTimeMS: 3000 });

  await Promise.all(duplicateRelationships.map(({ _id: relationship }) =>
    consolidateDoctorPatientConversations(relationship.doctorId, relationship.patientId)
  ));
};

/**
 * Send message
 * Supports both doctor-patient (with appointment) and admin-doctor (without appointment) conversations
 */
const sendMessage = async (data) => {
  const { doctorId, patientId, adminId, senderId, message, attachments, appointmentId, conversationId } = data;
  const normalizedAttachments = normalizeChatAttachments(attachments);

  const isAdminDoctorChat = !!adminId;
  const isDoctorPatientChat = !!patientId;

  if (!isAdminDoctorChat && !isDoctorPatientChat) {
    throw new Error('Either admin-doctor or doctor-patient conversation must be specified');
  }

  const sender = await User.findById(senderId);
  if (!sender) {
    throw new Error('Sender not found');
  }

  if (isAdminDoctorChat) {
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

    if (!sameId(senderId, adminId) && !sameId(senderId, doctorId)) {
      throw new Error('Sender must be either admin or doctor');
    }

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

    if (doctor.status !== 'APPROVED') {
      throw new Error(`Doctor account is ${doctor.status.toLowerCase()}. Cannot send message to inactive doctor.`);
    }

    const chatMessage = await ChatMessage.create({
      conversationId: conversation._id,
      adminId,
      doctorId,
      senderId,
      message: message || null,
      attachments: normalizedAttachments.length ? normalizedAttachments : null,
      isRead: false
    });

    if (sameId(senderId, adminId)) {
      try {
        await Notification.create({
          userId: doctorId,
          title: 'New Message from Admin',
          body: message ? (message.length > 100 ? message.substring(0, 100) + '...' : message) : 'You have a new message',
          i18n: {
            title: { it: 'Nuovo messaggio dall\'amministratore' },
            body: {
              it: message
                ? (message.length > 100 ? message.substring(0, 100) + '...' : message)
                : 'Hai un nuovo messaggio',
            },
          },
          type: 'CHAT',
          data: {
            conversationId: conversation._id.toString(),
            messageId: chatMessage._id.toString(),
            senderId: adminId.toString()
          },
          isRead: false
        });
      } catch (notificationError) {
        console.error('Failed to create notification:', notificationError);
      }
    }

    return chatMessage;
  }

  // Doctor-Patient conversation
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

  if (!sameId(senderId, doctorId) && !sameId(senderId, patientId)) {
    throw new Error('Sender must be either doctor or patient');
  }

  if (!appointmentId) {
    throw new Error('Appointment ID is required for doctor-patient communication');
  }

  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (!sameId(appointment.doctorId, doctorId) || !sameId(appointment.patientId, patientId)) {
    throw new Error('Appointment does not match the provided doctor and patient');
  }

  if (!['CONFIRMED', 'COMPLETED'].includes(appointment.status)) {
    const statusMessages = {
      PENDING_PAYMENT: 'Appointment payment is pending. Communication will be available after payment and doctor confirmation.',
      PENDING: 'Appointment is pending doctor acceptance. Communication will be available after the doctor accepts the appointment.',
      REJECTED: 'This appointment was rejected. Communication is not available.',
      CANCELLED: 'This appointment was cancelled. Communication is not available.',
      NO_SHOW: 'This appointment was marked as no-show. Communication is not available.'
    };
    throw new Error(statusMessages[appointment.status] || 'Communication is not available for this appointment status.');
  }

  assertAppointmentChatHasStarted(appointment);

  let conversation = null;

  if (conversationId) {
    conversation = await Conversation.findById(conversationId);
    conversation = await resolveMergedConversation(conversation);
    if (!conversation || conversation.conversationType !== 'DOCTOR_PATIENT') {
      throw new Error('Conversation not found');
    }
    if (
      !sameId(conversation.doctorId, doctorId) ||
      !sameId(conversation.patientId, patientId)
    ) {
      throw new Error('Conversation does not belong to this doctor and patient');
    }
  } else {
    conversation = await consolidateDoctorPatientConversations(doctorId, patientId, appointment._id);
  }

  if (!conversation || !sameId(conversation.appointmentId, appointment._id)) {
    conversation = await getOrCreateConversation(doctorId, patientId, null, appointment._id, senderId);
  }

  if (conversation.status === 'COMPLETED') {
    const error = new Error('This chat has been marked as completed by the doctor. No further messages can be sent.');
    error.statusCode = 409;
    throw error;
  }

  const now = new Date();
  conversation.lastMessageAt = now;
  conversation.lastMessage = {
    message: message || (normalizedAttachments.length ? 'Attachment' : ''),
    sentAt: now,
    sentBy: senderId
  };
  await conversation.save();

  const chatMessage = await ChatMessage.create({
    conversationId: conversation._id,
    doctorId,
    patientId,
    senderId,
    appointmentId: appointment._id,
    message: message || null,
    attachments: normalizedAttachments.length ? normalizedAttachments : null,
    isRead: false
  });

  return chatMessage;
};

/**
 * Get messages for conversation
 */
const getMessages = async (conversationId, userId, options = {}) => {
  const { page = 1, limit = 50 } = options;

  let conversation = await Conversation.findById(conversationId);
  conversation = await resolveMergedConversation(conversation);

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  assertConversationParticipant(conversation, userId);

  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    ChatMessage.find({ conversationId: conversation._id })
      .populate('senderId', 'fullName profileImage role')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    ChatMessage.countDocuments({ conversationId: conversation._id })
  ]);

  const responseConversation = await Conversation.findById(conversation._id)
    .populate('doctorId', 'fullName email phone profileImage')
    .populate('patientId', 'fullName email phone profileImage')
    .populate('appointmentId', 'appointmentDate appointmentTime appointmentEndTime status');

  return {
    messages: messages.reverse(),
    conversation: responseConversation,
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
 */
const getOrCreateConversation = async (doctorId, patientId, adminId, appointmentId, actorId = null) => {
  const isAdminDoctorChat = !!adminId;
  const isDoctorPatientChat = !!patientId;

  if (!isAdminDoctorChat && !isDoctorPatientChat) {
    throw new Error('Either admin-doctor or doctor-patient conversation must be specified');
  }

  if (isAdminDoctorChat) {
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
  }

  if (!appointmentId) {
    throw new Error('Appointment ID is required for doctor-patient conversation');
  }

  const appointment = await Appointment.findById(appointmentId);

  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }

  if (!sameId(appointment.doctorId, doctorId) || !sameId(appointment.patientId, patientId)) {
    throw new Error('Appointment does not match the provided doctor and patient');
  }

  if (actorId && !sameId(actorId, doctorId) && !sameId(actorId, patientId)) {
    throw new Error('You do not have access to this appointment chat');
  }

  // A conversation may have been created by an older version before the
  // appointment began. Enforce the start rule for both existing and new chats.
  assertAppointmentChatHasStarted(appointment);

  // One ongoing relationship chat is reused for each future appointment.
  // Any legacy appointment-specific conversations are merged into it first.
  let conversation = await consolidateDoctorPatientConversations(doctorId, patientId, appointment._id);

  const isNewAppointmentForConversation = conversation &&
    !sameId(conversation.appointmentId?._id || conversation.appointmentId, appointment._id);

  if (isNewAppointmentForConversation && !['CONFIRMED', 'COMPLETED'].includes(appointment.status)) {
    throw new Error('Appointment must be confirmed before communication can begin');
  }

  if (conversation && conversation.status === 'COMPLETED') {
    if (sameId(conversation.appointmentId?._id || conversation.appointmentId, appointment._id)) {
      const error = new Error('This chat has been marked as completed by the doctor. No further messages can be sent.');
      error.statusCode = 409;
      throw error;
    }

    conversation.status = 'ACTIVE';
    conversation.completedAt = null;
    conversation.completedBy = null;
  }

  if (!conversation) {
    if (!['CONFIRMED', 'COMPLETED'].includes(appointment.status)) {
      throw new Error('Appointment must be confirmed before communication can begin');
    }

    await subscriptionPolicy.enforceChatStartLimit({ doctorId });

    try {
      conversation = await Conversation.create({
        doctorId,
        patientId,
        appointmentId: appointment._id,
        conversationType: 'DOCTOR_PATIENT',
        relationshipKey: relationshipKeyFor(doctorId, patientId),
        lastMessageAt: new Date()
      });
    } catch (error) {
      if (!isDuplicateKeyError(error, 'relationshipKey')) throw error;
      conversation = await Conversation.findOne({
        relationshipKey: relationshipKeyFor(doctorId, patientId),
        mergedInto: null,
      });
      if (!conversation) throw error;
    }
    await conversation.populate('doctorId', 'fullName email phone profileImage');
    await conversation.populate('patientId', 'fullName email phone profileImage');
    await conversation.populate('appointmentId', 'appointmentDate appointmentTime status');
  } else if (isNewAppointmentForConversation) {
    conversation.appointmentId = appointment._id;
    conversation.lastMessageAt = new Date();
    await conversation.save();
    await conversation.populate('doctorId', 'fullName email phone profileImage');
    await conversation.populate('patientId', 'fullName email phone profileImage');
    await conversation.populate('appointmentId', 'appointmentDate appointmentTime status');
  } else {
    await conversation.populate('doctorId', 'fullName email phone profileImage');
    await conversation.populate('patientId', 'fullName email phone profileImage');
    await conversation.populate('appointmentId', 'appointmentDate appointmentTime status');
    if (conversation.isModified()) {
      await conversation.save();
    }
  }

  return conversation;
};

/**
 * Get conversations for a user (admin, doctor or patient)
 */
const getConversations = async (userId, userRole, options = {}) => {
  const { page = 1, limit = 20 } = options;

  // One-time, lossless upgrade path for duplicate conversations created under
  // the older appointment-per-chat behaviour.
  await consolidateLegacyConversationsForUser(userId, userRole);

  let query = {};

  if (userRole === 'ADMIN') {
    query = { adminId: userId, conversationType: 'ADMIN_DOCTOR' };
  } else if (userRole === 'DOCTOR') {
    query = {
      $or: [
        { doctorId: userId, conversationType: 'ADMIN_DOCTOR' },
        { doctorId: userId, conversationType: 'DOCTOR_PATIENT' }
      ]
    };
  } else if (userRole === 'PATIENT') {
    query = { patientId: userId, conversationType: 'DOCTOR_PATIENT' };
  } else {
    throw new Error('Invalid role. Only ADMIN, DOCTOR and PATIENT can list conversations.');
  }

  query = { ...query, mergedInto: null };

  const skip = (page - 1) * limit;

  const [conversations, total] = await Promise.all([
    Conversation.find(query)
      .populate('adminId', 'fullName email phone profileImage')
      .populate('doctorId', 'fullName email phone profileImage')
      .populate('patientId', 'fullName email phone profileImage')
      .populate('appointmentId', 'appointmentDate appointmentTime appointmentEndTime status')
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit),
    Conversation.countDocuments(query)
  ]);

  const conversationIds = conversations.map((conversation) => conversation._id);
  const unreadAggregation = conversationIds.length > 0
    ? await ChatMessage.aggregate([
        {
          $match: {
            conversationId: { $in: conversationIds },
            senderId: { $ne: new mongoose.Types.ObjectId(userId) },
            isRead: false
          }
        },
        { $group: { _id: '$conversationId', count: { $sum: 1 } } }
      ])
    : [];

  const unreadMap = {};
  unreadAggregation.forEach((entry) => {
    unreadMap[entry._id.toString()] = entry.count;
  });

  const conversationsWithUnread = conversations.map((conversation) => {
    const conversationObj = conversation.toObject();
    conversationObj.unreadCount = unreadMap[conversation._id.toString()] || 0;
    return conversationObj;
  });

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
 */
const markMessagesAsRead = async (conversationId, userId) => {
  let conversation = await Conversation.findById(conversationId);
  conversation = await resolveMergedConversation(conversation);

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  assertConversationParticipant(conversation, userId);

  const result = await ChatMessage.updateMany(
    {
      conversationId: conversation._id,
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
 */
const getUnreadCount = async (userId, userRole) => {
  let conversationQuery = {};

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return 0;
  }

  if (userRole === 'ADMIN') {
    conversationQuery = { adminId: userId, conversationType: 'ADMIN_DOCTOR' };
  } else if (userRole === 'DOCTOR') {
    conversationQuery = {
      $or: [
        { doctorId: userId, conversationType: 'ADMIN_DOCTOR' },
        { doctorId: userId, conversationType: 'DOCTOR_PATIENT' }
      ]
    };
  } else if (userRole === 'PATIENT') {
    conversationQuery = { patientId: userId, conversationType: 'DOCTOR_PATIENT' };
  } else {
    return 0;
  }

  conversationQuery = { ...conversationQuery, mergedInto: null };

  const conversations = await Conversation.find(conversationQuery).select('_id');
  const conversationIds = conversations.map((conversation) => conversation._id);

  if (conversationIds.length === 0) return 0;

  return ChatMessage.countDocuments({
    conversationId: { $in: conversationIds },
    senderId: { $ne: new mongoose.Types.ObjectId(userId) },
    isRead: false
  });
};

/**
 * Mark conversation as completed (doctor only)
 */
const markConversationComplete = async (conversationId, doctorId) => {
  let conversation = await Conversation.findById(conversationId);
  conversation = await resolveMergedConversation(conversation);

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.conversationType !== 'DOCTOR_PATIENT') {
    throw new Error('Only doctor-patient conversations can be completed');
  }

  if (!sameId(conversation.doctorId, doctorId)) {
    const error = new Error('Only the assigned doctor can mark this chat as completed');
    error.statusCode = 403;
    throw error;
  }

  if (conversation.status === 'COMPLETED') {
    const error = new Error('Conversation is already marked as completed');
    error.statusCode = 409;
    throw error;
  }

  conversation.status = 'COMPLETED';
  conversation.completedAt = new Date();
  conversation.completedBy = doctorId;
  await conversation.save();

  return conversation;
};

module.exports = {
  sendMessage,
  getMessages,
  getOrCreateConversation,
  getConversations,
  markMessagesAsRead,
  getUnreadCount,
  markConversationComplete,
};
