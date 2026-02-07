const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const DoctorProfile = require('../models/doctorProfile.model');
const Specialization = require('../models/specialization.model');
const PasswordReset = require('../models/passwordReset.model');
const { generateToken } = require('../utils/jwt');
const { sendPasswordResetOTP, sendPasswordResetSuccess } = require('./email.service');
const { sendPhoneOtp, verifyPhoneOtp } = require('./twilioVerify.service');

/**
 * Register a new user (DOCTOR or PATIENT)
 * @param {Object} data - User registration data
 * @returns {Promise<Object>} User object and JWT token
 */
const registerUser = async (data) => {
  const { email, password, fullName, role, phone, gender, dob, profileImage, specializationId } = data;

  const normalizedRole = String(role || '').toUpperCase();
  const isPharmacyRegistration = normalizedRole === 'PHARMACY' || normalizedRole === 'PARAPHARMACY';

  if (isPharmacyRegistration) {
    if (!phone || !String(phone).trim()) {
      throw new Error('Phone number is required for pharmacy registration');
    }
    const trimmedPhone = String(phone).trim();
    if (!/^\+\d{7,15}$/.test(trimmedPhone)) {
      throw new Error('Phone number must be in international format (E.164), e.g. +1234567890');
    }
  }

  // Check if email already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Determine default status based on role
  // Patients are auto-approved, Doctors/Pharmacies need admin approval
  const defaultStatus = normalizedRole === 'PATIENT' ? 'APPROVED' : 'PENDING';

  // Create user (password will be hashed by pre-save hook in user.model.js)
  const user = await User.create({
    email: email.toLowerCase(),
    password: password, // Pre-save hook will hash this
    fullName,
    role: normalizedRole,
    phone: phone ? String(phone).trim() : phone,
    gender,
    dob: dob ? new Date(dob) : null,
    profileImage,
    status: defaultStatus
  });

  if (isPharmacyRegistration) {
    try {
      await sendPhoneOtp(String(user.phone).trim());
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw new Error(error?.message || 'Failed to send verification code');
    }
  }

  // If user is DOCTOR, create empty DoctorProfile if none exists
  if (normalizedRole === 'DOCTOR' && specializationId) {
    // Verify specialization exists (doctors can only select from admin-created specializations)
    const specialization = await Specialization.findById(specializationId);
    if (!specialization) {
      throw new Error('Invalid specialization. Please select from available specializations.');
    }

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

const sendPhoneOtpForUser = async (userId, phone = null) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const role = String(user.role || '').toUpperCase();
  if (role !== 'PHARMACY' && role !== 'PARAPHARMACY') {
    throw new Error('Phone verification is only available for pharmacy accounts');
  }

  const targetPhone = String(phone || user.phone || '').trim();
  if (!targetPhone) {
    throw new Error('Phone is required');
  }
  if (!/^\+\d{7,15}$/.test(targetPhone)) {
    throw new Error('Phone number must be in international format (E.164), e.g. +1234567890');
  }

  // If user is missing phone, store it
  if (!user.phone || String(user.phone).trim() !== targetPhone) {
    user.phone = targetPhone;
    await user.save();
  }

  const result = await sendPhoneOtp(targetPhone);
  return {
    status: result.status
  };
};

const verifyPhoneOtpForUser = async (userId, code, phone = null) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const role = String(user.role || '').toUpperCase();
  if (role !== 'PHARMACY' && role !== 'PARAPHARMACY') {
    throw new Error('Phone verification is only available for pharmacy accounts');
  }

  const targetPhone = String(phone || user.phone || '').trim();
  if (!targetPhone) {
    throw new Error('Phone is required');
  }
  if (!/^\+\d{7,15}$/.test(targetPhone)) {
    throw new Error('Phone number must be in international format (E.164), e.g. +1234567890');
  }

  const result = await verifyPhoneOtp(targetPhone, String(code));
  const isApproved = String(result.status || '').toLowerCase() === 'approved';

  if (!isApproved) {
    throw new Error('Invalid verification code');
  }

  user.isPhoneVerified = true;
  user.phone = targetPhone;
  await user.save();

  const userObj = user.toObject();
  delete userObj.password;

  return {
    verified: true,
    user: userObj
  };
};

const approvePharmacy = async (pharmacyUserId) => {
  const user = await User.findById(pharmacyUserId);

  if (!user) {
    throw new Error('Pharmacy user not found');
  }

  if (user.role !== 'PHARMACY' && user.role !== 'PARAPHARMACY') {
    throw new Error('User is not a pharmacy');
  }

  const requiredDocTypes = ['PHARMACY_LICENSE', 'PHARMACY_DEGREE'];
  const uploads = Array.isArray(user.documentUploads) ? user.documentUploads : [];
  const uploadedTypes = new Set(uploads.map((d) => String(d.type || '').toUpperCase()));

  const missing = requiredDocTypes.filter((t) => !uploadedTypes.has(t));
  if (missing.length > 0) {
    throw new Error(`Missing required pharmacy documents: ${missing.join(', ')}`);
  }

  user.isPharmacyDocumentsVerified = true;
  user.status = 'APPROVED';
  await user.save();

  return user;
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

  // Compare password FIRST to verify credentials
  if (!user.password) {
    throw new Error('Invalid email or password');
  }

  // Try password comparison
  let isPasswordValid = false;
  try {
    isPasswordValid = await bcrypt.compare(password, user.password);
  } catch (error) {
    // If comparison fails due to error, password is invalid
    throw new Error('Invalid email or password');
  }
  
  if (!isPasswordValid) {
    // Password comparison failed
    // Note: If user was registered before the double-hashing fix,
    // their password might be double-hashed and needs to be reset
    throw new Error('Invalid email or password');
  }

  // After password validation, check if doctor/pharmacy is pending approval
  if (user.role === 'DOCTOR' && user.status === 'PENDING') {
    // Still allow login but return a message
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
      token,
      message: 'Your account is pending admin approval. You can complete your profile and purchase a subscription, but you will not be visible to patients until approved.'
    };
  }

  if ((user.role === 'PHARMACY' || user.role === 'PARAPHARMACY') && user.status === 'PENDING') {
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    });

    const userObj = user.toObject();
    delete userObj.password;

    return {
      user: userObj,
      token,
      message: 'Your pharmacy account is pending admin approval. Please upload verification documents and wait for approval.'
    };
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

/**
 * Request password reset - Send OTP to email
 * @param {string} email - User email
 * @returns {Promise<Object>} Success message
 */
const requestPasswordReset = async (email) => {
  // Find user by email
  const user = await User.findOne({ email: email.toLowerCase() });
  
  if (!user) {
    throw new Error('Email is not registered');
  }

  // Generate 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  // Delete any existing reset codes for this email
  await PasswordReset.deleteMany({ email: email.toLowerCase() });

  // Create new password reset record
  await PasswordReset.create({
    email: email.toLowerCase(),
    code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  });

  // Send OTP via email
  await sendPasswordResetOTP(email.toLowerCase(), code, user.fullName);

  return { message: 'Verification code has been sent to your email.' };
};

/**
 * Verify password reset OTP code
 * @param {string} email - User email
 * @param {string} code - OTP code
 * @returns {Promise<Object>} Success message with reset token
 */
const verifyPasswordResetCode = async (email, code) => {
  // Find valid reset record
  const resetRecord = await PasswordReset.findOne({
    email: email.toLowerCase(),
    code,
    expiresAt: { $gt: new Date() }, // Not expired
    used: false
  });

  if (!resetRecord) {
    throw new Error('Invalid or expired verification code');
  }

  // Mark as verified
  resetRecord.verified = true;
  await resetRecord.save();

  // Return success (code is verified, ready for password reset)
  return { message: 'Verification code is valid', verified: true };
};

/**
 * Reset password with verified code
 * @param {string} email - User email
 * @param {string} code - Verified OTP code
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Success message
 */
const resetPassword = async (email, code, newPassword) => {
  // Find verified reset record
  const resetRecord = await PasswordReset.findOne({
    email: email.toLowerCase(),
    code,
    verified: true,
    expiresAt: { $gt: new Date() }, // Not expired
    used: false
  });

  if (!resetRecord) {
    throw new Error('Invalid or expired verification code. Please request a new code.');
  }

  // Find user
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new Error('User not found');
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  // Update user password
  user.password = hashedPassword;
  await user.save();

  // Mark reset record as used
  resetRecord.used = true;
  await resetRecord.save();

  // Delete all reset records for this email
  await PasswordReset.deleteMany({ email: email.toLowerCase() });

  // Send success email
  await sendPasswordResetSuccess(email.toLowerCase(), user.fullName);

  return { message: 'Password reset successfully' };
};

module.exports = {
  registerUser,
  loginUser,
  approveDoctor,
  approvePharmacy,
  changePassword,
  refreshToken,
  requestPasswordReset,
  verifyPasswordResetCode,
  resetPassword,
  sendPhoneOtpForUser,
  verifyPhoneOtpForUser
};
