const DoctorProfile = require('../models/doctorProfile.model');
const User = require('../models/user.model');
const Review = require('../models/review.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');
const Specialization = require('../models/specialization.model');
const Product = require('../models/product.model');

/**
 * Upsert doctor profile (create or update)
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data
 * @returns {Promise<Object>} Doctor profile
 */
const upsertDoctorProfile = async (userId, profileData) => {
  // Verify user is a doctor
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (user.role !== 'DOCTOR') {
    throw new Error('User is not a doctor');
  }

  // Handle specializationId or specialization field (support both for compatibility)
  const specializationId = profileData.specializationId || profileData.specialization;
  
  // Remove specializationId from profileData to avoid confusion (we'll use 'specialization' field)
  if (profileData.specializationId) {
    delete profileData.specializationId;
  }
  
  // If specialization is being set/updated, verify it exists (doctors can only select from admin-created specializations)
  if (specializationId) {
    const specialization = await Specialization.findById(specializationId);
    if (!specialization) {
      throw new Error('Invalid specialization. Please select from available specializations.');
    }
    // Set specialization field in profileData (use the verified ID)
    // This will overwrite any existing specialization value
    profileData.specialization = specializationId;
  }

  // Find or create profile
  let profile = await DoctorProfile.findOne({ userId });

  if (!profile) {
    // Create new profile
    profile = await DoctorProfile.create({
      userId,
      ...profileData
    });
    
    // Link profile to user
    user.doctorProfile = profile._id;
    await user.save();
  } else {
    // Update existing profile - merge new data
    // Explicitly handle specialization first to ensure it's set
    if (profileData.specialization !== undefined) {
      profile.specialization = profileData.specialization;
    }
    
    Object.keys(profileData).forEach(key => {
      // Skip specialization as we already handled it above
      if (key === 'specialization') {
        return;
      }
      
      if (profileData[key] !== undefined && profileData[key] !== null) {
        if (key === 'services' || key === 'clinics' || key === 'education' || 
            key === 'experience' || key === 'awards' || key === 'memberships') {
          // For arrays, replace if provided
          profile[key] = profileData[key];
        } else if (key === 'consultationFees' || key === 'socialLinks') {
          // For nested objects, merge
          profile[key] = { ...profile[key], ...profileData[key] };
        } else {
          // For other fields, set directly
          profile[key] = profileData[key];
        }
      }
    });
    
    await profile.save();
  }

  // Calculate and update profileCompleted flag
  const isProfileCompleted = !!(
    profile.title &&
    profile.biography &&
    profile.specialization &&
    profile.clinics && profile.clinics.length > 0 &&
    profile.services && profile.services.length > 0
  );
  
  profile.profileCompleted = isProfileCompleted;
  await profile.save();

  return profile;
};

/**
 * Get doctor profile by user ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Doctor profile with user data and products
 */
const getDoctorProfile = async (userId) => {
  const profile = await DoctorProfile.findOne({ userId })
    .populate('specialization')
    .populate('userId', 'fullName email phone profileImage status');
  
  if (!profile) {
    throw new Error('Doctor profile not found');
  }

  // Get doctor's products (only active products)
  const products = await Product.find({
    sellerId: userId,
    sellerType: 'DOCTOR',
    isActive: true
  })
    .select('name price discountPrice images category stock')
    .sort({ createdAt: -1 })
    .limit(20);

  // Convert profile to object and add products
  const profileObj = profile.toObject();
  profileObj.products = products;

  return profileObj;
};

/**
 * List doctors with filtering
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Doctors and pagination info
 */
const listDoctors = async (filter = {}) => {
  const {
    specializationId,
    city,
    isFeatured,
    isAvailableOnline,
    search,
    page = 1,
    limit = 10
  } = filter;

  const query = {};

  if (specializationId) {
    query.specialization = specializationId;
  }

  if (city) {
    query['clinics.city'] = { $regex: city, $options: 'i' };
  }

  if (isFeatured !== undefined) {
    query.isFeatured = isFeatured === true || isFeatured === 'true';
  }

  if (isAvailableOnline !== undefined) {
    query.isAvailableOnline = isAvailableOnline === true || isAvailableOnline === 'true';
  }

  // Only show APPROVED doctors (exclude PENDING, REJECTED, BLOCKED)
  // Filter by user status: APPROVED only
  const approvedDoctors = await User.find({ 
    role: 'DOCTOR', 
    status: 'APPROVED' 
  }).select('_id');
  
  const approvedDoctorIds = approvedDoctors.map(doc => doc._id);
  
  // Add status filter to query - only show profiles of APPROVED doctors
  query.userId = { $in: approvedDoctorIds };

  const skip = (page - 1) * limit;

  const [doctors, total] = await Promise.all([
    DoctorProfile.find(query)
      .populate('specialization')
      .populate('userId', 'fullName email phone profileImage status')
      .skip(skip)
      .limit(limit)
      .sort({ ratingAvg: -1, createdAt: -1 }),
    DoctorProfile.countDocuments(query)
  ]);

  // Filter out any doctors that might have been rejected/blocked after query
  const filteredDoctors = doctors.filter(doctor => 
    doctor.userId && 
    doctor.userId.status === 'APPROVED'
  );

  // Get products for each doctor (limit to 5 products per doctor for listing)
  const doctorsWithProducts = await Promise.all(
    filteredDoctors.map(async (doctor) => {
      const doctorObj = doctor.toObject();
      // Get doctor's active products
      const products = await Product.find({
        sellerId: doctor.userId._id,
        sellerType: 'DOCTOR',
        isActive: true
      })
        .select('name price discountPrice images category stock')
        .sort({ createdAt: -1 })
        .limit(5);
      
      doctorObj.products = products;
      return doctorObj;
    })
  );

  return {
    doctors: doctorsWithProducts,
    pagination: {
      page,
      limit,
      total: filteredDoctors.length,
      pages: Math.ceil(filteredDoctors.length / limit)
    }
  };
};

/**
 * Update doctor rating after review
 * @param {string} doctorId - Doctor user ID
 * @returns {Promise<Object>} Updated profile
 */
const updateDoctorRating = async (doctorId) => {
  const profile = await DoctorProfile.findOne({ userId: doctorId });
  
  if (!profile) {
    throw new Error('Doctor profile not found');
  }

  // Calculate average rating from all reviews
  const reviews = await Review.find({ doctorId });
  
  if (reviews.length === 0) {
    profile.ratingAvg = 0;
    profile.ratingCount = 0;
  } else {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    profile.ratingAvg = totalRating / reviews.length;
    profile.ratingCount = reviews.length;
  }

  await profile.save();

  return profile;
};

/**
 * Doctor buys/selects a subscription plan
 * @param {string} doctorId - Doctor user ID
 * @param {string} planId - Subscription plan ID
 * @returns {Promise<Object>} Updated doctor with subscription info
 */
const buySubscriptionPlan = async (doctorId, planId) => {
  const doctor = await User.findById(doctorId);
  
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  if (doctor.role !== 'DOCTOR') {
    throw new Error('User is not a doctor');
  }

  const plan = await SubscriptionPlan.findById(planId);
  
  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  if (plan.status !== 'ACTIVE') {
    throw new Error('Subscription plan is not active');
  }

  // Calculate expiration date
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationInDays);

  // Update doctor subscription
  doctor.subscriptionPlan = planId;
  doctor.subscriptionExpiresAt = endDate;

  await doctor.save();

  // Populate plan details
  await doctor.populate('subscriptionPlan', 'name price durationInDays features status');
  
  const doctorObj = doctor.toObject();
  delete doctorObj.password;

  return {
    doctor: doctorObj,
    subscriptionPlan: doctor.subscriptionPlan,
    subscriptionExpiresAt: doctor.subscriptionExpiresAt
  };
};

/**
 * Get doctor's current subscription plan
 * @param {string} doctorId - Doctor user ID
 * @returns {Promise<Object>} Doctor's subscription plan info
 */
const getMySubscriptionPlan = async (doctorId) => {
  const doctor = await User.findById(doctorId)
    .populate('subscriptionPlan', 'name price durationInDays features status');
  
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  if (doctor.role !== 'DOCTOR') {
    throw new Error('User is not a doctor');
  }

  return {
    subscriptionPlan: doctor.subscriptionPlan,
    subscriptionExpiresAt: doctor.subscriptionExpiresAt,
    hasActiveSubscription: doctor.subscriptionPlan && 
                          doctor.subscriptionExpiresAt && 
                          new Date(doctor.subscriptionExpiresAt) > new Date()
  };
};

/**
 * Get doctor dashboard statistics
 * @param {string} doctorId - Doctor user ID
 * @returns {Promise<Object>} Dashboard stats
 */
const getDoctorDashboard = async (doctorId) => {
  const doctor = await User.findById(doctorId)
    .populate('subscriptionPlan', 'name price durationInDays features status')
    .populate('doctorProfile');
  
  if (!doctor || doctor.role !== 'DOCTOR') {
    throw new Error('Doctor not found');
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // Get start of week (Monday)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);

  const Appointment = require('../models/appointment.model');
  const Review = require('../models/review.model');
  const Transaction = require('../models/transaction.model');
  const Conversation = require('../models/conversation.model');
  const Notification = require('../models/notification.model');

  // Get appointments
  const [
    todayAppointments,
    weeklyAppointments,
    upcomingAppointments,
    allAppointments
  ] = await Promise.all([
    Appointment.find({
      doctorId,
      appointmentDate: {
        $gte: todayStart,
        $lte: todayEnd
      }
    })
      .populate('patientId', 'fullName email phone profileImage')
      .sort({ appointmentTime: 1 }),
    Appointment.find({
      doctorId,
      appointmentDate: { $gte: weekStart }
    }),
    Appointment.find({
      doctorId,
      appointmentDate: { $gte: now },
      status: { $in: ['PENDING', 'CONFIRMED'] }
    })
      .populate('patientId', 'fullName email phone profileImage')
      .sort({ appointmentDate: 1, appointmentTime: 1 })
      .limit(10),
    Appointment.find({ doctorId })
  ]);

  // Get total patients (unique patients who have appointments)
  const uniquePatients = new Set();
  allAppointments.forEach(apt => {
    if (apt.patientId) {
      uniquePatients.add(apt.patientId.toString());
    }
  });
  const totalPatientsCount = uniquePatients.size;

  // Get earnings from appointments
  const appointmentTransactions = await Transaction.find({
    relatedAppointmentId: { $in: allAppointments.map(a => a._id) },
    status: 'SUCCESS'
  });
  const earningsFromAppointments = appointmentTransactions.reduce(
    (sum, txn) => sum + (txn.amount || 0), 0
  );

  // Get unread messages count
  const unreadMessagesCount = await Conversation.countDocuments({
    participants: doctorId,
    lastMessage: { $exists: true },
    'lastMessage.readBy': { $ne: doctorId }
  });

  // Get unread notifications count
  const unreadNotificationsCount = await Notification.countDocuments({
    userId: doctorId,
    isRead: false
  });

  // Calculate profile strength
  const profile = doctor.doctorProfile || await DoctorProfile.findOne({ userId: doctorId });
  let profileStrength = 0;
  if (profile) {
    if (profile.title) profileStrength += 10;
    if (profile.biography) profileStrength += 10;
    if (profile.specialization) profileStrength += 10;
    if (profile.experienceYears) profileStrength += 10;
    if (profile.services && profile.services.length > 0) profileStrength += 15;
    if (profile.clinics && profile.clinics.length > 0) profileStrength += 15;
    if (profile.education && profile.education.length > 0) profileStrength += 10;
    if (profile.experience && profile.experience.length > 0) profileStrength += 10;
    if (profile.consultationFees && (profile.consultationFees.clinic || profile.consultationFees.online)) profileStrength += 10;
  }

  // Subscription status
  const hasActiveSubscription = doctor.subscriptionPlan && 
                                doctor.subscriptionExpiresAt && 
                                new Date(doctor.subscriptionExpiresAt) > now;
  const subscriptionExpiresIn = doctor.subscriptionExpiresAt 
    ? Math.ceil((new Date(doctor.subscriptionExpiresAt) - now) / (1000 * 60 * 60 * 24))
    : null;

  return {
    doctor: {
      id: doctor._id,
      fullName: doctor.fullName,
      email: doctor.email,
      status: doctor.status,
      profileImage: doctor.profileImage
    },
    todayAppointments: {
      count: todayAppointments.length,
      appointments: todayAppointments
    },
    weeklyAppointments: {
      count: weeklyAppointments.length
    },
    upcomingAppointments: {
      count: upcomingAppointments.length,
      appointments: upcomingAppointments
    },
    totalPatients: totalPatientsCount,
    earningsFromAppointments,
    unreadMessagesCount,
    unreadNotificationsCount,
    profileStrength: Math.min(profileStrength, 100),
    profileCompleted: profile ? profile.profileCompleted || false : false,
    subscription: {
      plan: doctor.subscriptionPlan,
      expiresAt: doctor.subscriptionExpiresAt,
      hasActiveSubscription,
      expiresInDays: subscriptionExpiresIn
    },
    rating: profile ? {
      average: profile.ratingAvg || 0,
      count: profile.ratingCount || 0
    } : { average: 0, count: 0 }
  };
};

/**
 * Get doctor's reviews
 * @param {string} doctorId - Doctor user ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Reviews and pagination info
 */
const getDoctorReviews = async (doctorId, options = {}) => {
  const { page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const Review = require('../models/review.model');
  
  const [reviews, total] = await Promise.all([
    Review.find({ doctorId })
      .populate('patientId', 'fullName email profileImage')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Review.countDocuments({ doctorId })
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

module.exports = {
  upsertDoctorProfile,
  getDoctorProfile,
  listDoctors,
  updateDoctorRating,
  buySubscriptionPlan,
  getMySubscriptionPlan,
  getDoctorDashboard,
  getDoctorReviews
};

