const User = require('../models/user.model');

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object
 */
const getUserById = async (userId) => {
  const user = await User.findById(userId).select('-password');
  
  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated user
 */
const updateUserProfile = async (userId, data) => {
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Update allowed fields
  if (data.fullName !== undefined) user.fullName = data.fullName;
  if (data.phone !== undefined) user.phone = data.phone;
  if (data.gender !== undefined) user.gender = data.gender;
  if (data.dob !== undefined) user.dob = data.dob ? new Date(data.dob) : null;
  if (data.profileImage !== undefined) user.profileImage = data.profileImage;
  if (data.bloodGroup !== undefined) user.bloodGroup = data.bloodGroup;
  
  if (data.address) {
    user.address = {
      line1: data.address.line1 || user.address?.line1 || null,
      line2: data.address.line2 || user.address?.line2 || null,
      city: data.address.city || user.address?.city || null,
      state: data.address.state || user.address?.state || null,
      country: data.address.country || user.address?.country || null,
      zip: data.address.zip || user.address?.zip || null
    };
  }

  if (data.emergencyContact) {
    user.emergencyContact = {
      name: data.emergencyContact.name || user.emergencyContact?.name || null,
      phone: data.emergencyContact.phone || user.emergencyContact?.phone || null,
      relation: data.emergencyContact.relation || user.emergencyContact?.relation || null
    };
  }

  await user.save();

  const userObj = user.toObject();
  delete userObj.password;

  return userObj;
};

/**
 * Update user status (admin only)
 * @param {string} userId - User ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated user
 */
const updateStatus = async (userId, status) => {
  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid status');
  }

  user.status = status;
  await user.save();

  const userObj = user.toObject();
  delete userObj.password;

  return userObj;
};

/**
 * List users with filtering and pagination
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Users and pagination info
 */
const listUsers = async (filter = {}) => {
  const {
    role,
    status,
    search,
    page = 1,
    limit = 10
  } = filter;

  const query = {};

  if (role) {
    query.role = role.toUpperCase();
  }

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

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .populate('subscriptionPlan', 'name price durationInDays features status')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    User.countDocuments(query)
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * List all doctors with subscription info (admin only)
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Doctors and pagination info
 */
const listDoctors = async (filter = {}) => {
  const {
    status,
    subscriptionStatus,
    search,
    page = 1,
    limit = 10
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

  const [doctors, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .populate('subscriptionPlan', 'name price durationInDays features status')
      .populate('doctorProfile')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    User.countDocuments(query)
  ]);

  // Filter by subscription status if provided (check expiration date)
  let filteredDoctors = doctors;
  if (subscriptionStatus) {
    const now = new Date();
    filteredDoctors = doctors.filter(doctor => {
      if (subscriptionStatus.toUpperCase() === 'ACTIVE') {
        return doctor.subscriptionPlan && 
               doctor.subscriptionExpiresAt && 
               new Date(doctor.subscriptionExpiresAt) > now;
      } else if (subscriptionStatus.toUpperCase() === 'EXPIRED') {
        return !doctor.subscriptionPlan || 
               !doctor.subscriptionExpiresAt || 
               new Date(doctor.subscriptionExpiresAt) <= now;
      } else if (subscriptionStatus.toUpperCase() === 'NONE') {
        return !doctor.subscriptionPlan;
      }
      return true;
    });
  }

  return {
    doctors: filteredDoctors,
    pagination: {
      page,
      limit,
      total: subscriptionStatus ? filteredDoctors.length : total,
      pages: Math.ceil((subscriptionStatus ? filteredDoctors.length : total) / limit)
    }
  };
};

module.exports = {
  getUserById,
  updateUserProfile,
  updateStatus,
  listUsers,
  listDoctors
};
