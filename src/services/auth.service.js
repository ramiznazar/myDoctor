const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const DoctorProfile = require('../models/doctorProfile.model');
const { generateToken } = require('../utils/jwt');

/**
 * Register a new user (DOCTOR or PATIENT)
 * @param {Object} data - User registration data
 * @returns {Promise<Object>} User object and JWT token
 */
const registerUser = async (data) => {
  const { email, password, fullName, role, phone, gender, dob, profileImage, specializationId } = data;

  // Check if email already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const user = await User.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    fullName,
    role: role.toUpperCase(),
    phone,
    gender,
    dob: dob ? new Date(dob) : null,
    profileImage,
    status: 'PENDING'
  });

  // If user is DOCTOR, create empty DoctorProfile if none exists
  if (role.toUpperCase() === 'DOCTOR' && specializationId) {
    const doctorProfile = await DoctorProfile.create({
      userId: user._id,
      specialization: specializationId
    });
    
    user.doctorProfile = doctorProfile._id;
    await user.save();
  }

  // Generate JWT token
  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  });

  // Return user without password
  const userObj = user.toObject();
  delete userObj.password;

  return {
    user: userObj,
    token
  };
};

/**
 * Login user
 * @param {Object} data - Login credentials
 * @returns {Promise<Object>} User object and JWT token
 */
const loginUser = async (data) => {
  const { email, password } = data;

  // Find user with password
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Check if user is blocked or rejected
  if (user.status === 'BLOCKED' || user.status === 'REJECTED') {
    throw new Error('Account is blocked or rejected');
  }

  // Compare password
  if (!user.password) {
    throw new Error('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  // Generate JWT token
  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  });

  // Return user without password
  const userObj = user.toObject();
  delete userObj.password;

  return {
    user: userObj,
    token
  };
};

/**
 * Approve doctor (admin only)
 * @param {string} doctorId - Doctor user ID
 * @returns {Promise<Object>} Updated user
 */
const approveDoctor = async (doctorId) => {
  const user = await User.findById(doctorId);
  
  if (!user) {
    throw new Error('Doctor not found');
  }

  if (user.role !== 'DOCTOR') {
    throw new Error('User is not a doctor');
  }

  user.status = 'APPROVED';
  await user.save();

  return user;
};

/**
 * Change user password
 * @param {string} userId - User ID
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Success message
 */
const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await User.findById(userId).select('+password');
  
  if (!user) {
    throw new Error('User not found');
  }

  if (!user.password) {
    throw new Error('Password not set');
  }

  // Verify old password
  const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
  if (!isPasswordValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  user.password = hashedPassword;
  await user.save();

  return { message: 'Password changed successfully' };
};

/**
 * Refresh JWT token
 * @param {string} token - Refresh token (for now, same as access token)
 * @returns {Promise<Object>} New token
 */
const refreshToken = async (token) => {
  const { verifyToken } = require('../utils/jwt');
  
  try {
    const decoded = verifyToken(token);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate new token
    const newToken = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });

    return { token: newToken };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

module.exports = {
  registerUser,
  loginUser,
  approveDoctor,
  changePassword,
  refreshToken
};
