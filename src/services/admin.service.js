const User = require('../models/user.model');
const Appointment = require('../models/appointment.model');
const Transaction = require('../models/transaction.model');
const DoctorProfile = require('../models/doctorProfile.model');
const Review = require('../models/review.model');
const Conversation = require('../models/conversation.model');
const ChatMessage = require('../models/chatMessage.model');

/**
 * Get dashboard statistics
 * @returns {Promise<Object>} Dashboard stats
 */
const getDashboardStats = async () => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [
    totalDoctors,
    totalPatients,
    totalAppointments,
    doctorsPendingApproval,
    activeSubscriptionsCount,
    todaysAppointmentsCount,
    totalEarnings
  ] = await Promise.all([
    User.countDocuments({ role: 'DOCTOR' }),
    User.countDocuments({ role: 'PATIENT' }),
    Appointment.countDocuments(),
    User.countDocuments({ role: 'DOCTOR', status: 'PENDING' }),
    User.countDocuments({
      role: 'DOCTOR',
      subscriptionPlan: { $ne: null },
      subscriptionExpiresAt: { $gt: new Date() }
    }),
    Appointment.countDocuments({
      appointmentDate: {
        $gte: todayStart,
        $lte: todayEnd
      }
    }),
    Transaction.aggregate([
      { $match: { status: 'SUCCESS' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  return {
    totalDoctors,
    totalPatients,
    totalAppointments,
    totalEarnings: totalEarnings[0]?.total || 0,
    doctorsPendingApproval,
    activeSubscriptionsCount,
    todaysAppointmentsCount
  };
};

/**
 * Delete user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Success message
 */
const deleteUser = async (userId) => {
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // If doctor, also delete profile
  if (user.role === 'DOCTOR' && user.doctorProfile) {
    await DoctorProfile.findByIdAndDelete(user.doctorProfile);
  }

  await User.findByIdAndDelete(userId);

  return { message: 'User deleted successfully' };
};

/**
 * Get system activity (placeholder - can be enhanced with activity logs)
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Activity data
 */
const getSystemActivity = async (options = {}) => {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  // Placeholder: Return recent appointments and transactions as activity
  const [recentAppointments, recentTransactions] = await Promise.all([
    Appointment.find()
      .populate('doctorId', 'fullName email')
      .populate('patientId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip),
    Transaction.find()
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
  ]);

  return {
    appointments: recentAppointments,
    transactions: recentTransactions,
    pagination: {
      page,
      limit,
      total: recentAppointments.length + recentTransactions.length,
      pages: Math.ceil((recentAppointments.length + recentTransactions.length) / limit)
    }
  };
};

/**
 * Get all reviews (admin only)
 * @param {Object} filter - Filter options
 * @returns {Promise<Object>} Reviews and pagination info
 */
const getAllReviews = async (filter = {}) => {
  const { doctorId, patientId, rating, page = 1, limit = 20 } = filter;
  const skip = (page - 1) * limit;

  const query = {};

  if (doctorId) {
    query.doctorId = doctorId;
  }

  if (patientId) {
    query.patientId = patientId;
  }

  if (rating) {
    query.rating = parseInt(rating);
  }

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('doctorId', 'fullName email profileImage')
      .populate('patientId', 'fullName email profileImage')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Review.countDocuments(query)
  ]);

  return {
    reviews,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get all payment transactions only (exclude non-payment transactions)
 * @param {Object} filter - Filter options
 * @returns {Promise<Object>} Transactions and pagination info
 */
const getAllPaymentTransactions = async (filter = {}) => {
  const { status, fromDate, toDate, page = 1, limit = 20 } = filter;
  const skip = (page - 1) * limit;

  // Only get transactions that have payment-related fields (amount > 0 and status)
  const query = {
    amount: { $gt: 0 } // Only payment transactions have amount > 0
  };

  if (status) {
    query.status = status.toUpperCase();
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      query.createdAt.$gte = new Date(fromDate);
    }
    if (toDate) {
      query.createdAt.$lte = new Date(toDate);
    }
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate('userId', 'fullName email')
      .populate('relatedAppointmentId', 'appointmentNumber appointmentDate')
      .populate('relatedSubscriptionId', 'name price')
      .populate('relatedProductId', 'name price')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Transaction.countDocuments(query)
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get all doctors for admin chat panel with unread message counts
 * @param {Object} filter - Filter options
 * @returns {Promise<Object>} Doctors with unread counts and pagination info
 */
const getDoctorsForChat = async (adminId, filter = {}) => {
  const {
    search,
    specializationId,
    status,
    page = 1,
    limit = 20
  } = filter;

  const query = { role: 'DOCTOR' };

  if (status) {
    query.status = status.toUpperCase();
  }

  if (search) {
    query.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  // Get doctors with their profiles
  const [doctors, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .populate('doctorProfile')
      .populate({
        path: 'doctorProfile',
        populate: {
          path: 'specialization',
          select: 'name'
        }
      })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    User.countDocuments(query)
  ]);

  // Get unread message counts for each doctor
  const doctorsWithUnread = await Promise.all(
    doctors.map(async (doctor) => {
      const doctorObj = doctor.toObject();

      // Find conversation between admin and this doctor
      const conversation = await Conversation.findOne({
        adminId,
        doctorId: doctor._id,
        conversationType: 'ADMIN_DOCTOR'
      });

      let unreadCount = 0;
      if (conversation) {
        // Count unread messages (messages not sent by admin)
        unreadCount = await ChatMessage.countDocuments({
          conversationId: conversation._id,
          senderId: { $ne: adminId },
          isRead: false
        });
      }

      doctorObj.unreadMessageCount = unreadCount;
      doctorObj.hasConversation = !!conversation;

      // Filter by specialization if provided
      if (specializationId) {
        const profile = doctor.doctorProfile;
        if (profile && profile.specialization && profile.specialization._id.toString() === specializationId) {
          return doctorObj;
        }
        return null;
      }

      return doctorObj;
    })
  );

  // Filter out null values (from specialization filter)
  const filteredDoctors = doctorsWithUnread.filter(d => d !== null);

  return {
    doctors: filteredDoctors,
    pagination: {
      page,
      limit,
      total: specializationId ? filteredDoctors.length : total,
      pages: Math.ceil((specializationId ? filteredDoctors.length : total) / limit)
    }
  };
};

module.exports = {
  getDashboardStats,
  deleteUser,
  getSystemActivity,
  getAllReviews,
  getAllPaymentTransactions,
  getDoctorsForChat
};






