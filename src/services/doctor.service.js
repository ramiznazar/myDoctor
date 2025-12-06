const DoctorProfile = require('../models/doctorProfile.model');
const User = require('../models/user.model');
const Review = require('../models/review.model');

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
    Object.keys(profileData).forEach(key => {
      if (profileData[key] !== undefined) {
        if (key === 'services' || key === 'clinics' || key === 'education' || 
            key === 'experience' || key === 'awards' || key === 'memberships') {
          // For arrays, replace if provided
          profile[key] = profileData[key];
        } else if (key === 'consultationFees' || key === 'socialLinks') {
          // For nested objects, merge
          profile[key] = { ...profile[key], ...profileData[key] };
        } else {
          profile[key] = profileData[key];
        }
      }
    });
    
    await profile.save();
  }

  return profile;
};

/**
 * Get doctor profile by user ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Doctor profile with user data
 */
const getDoctorProfile = async (userId) => {
  const profile = await DoctorProfile.findOne({ userId })
    .populate('specialization')
    .populate('userId', 'fullName email phone profileImage status');
  
  if (!profile) {
    throw new Error('Doctor profile not found');
  }

  return profile;
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

  return {
    doctors,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
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

module.exports = {
  upsertDoctorProfile,
  getDoctorProfile,
  listDoctors,
  updateDoctorRating
};

