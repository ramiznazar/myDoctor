const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user.model');
const DoctorProfile = require('../models/doctorProfile.model');
const Specialization = require('../models/specialization.model');
const PasswordReset = require('../models/passwordReset.model');
const { generateToken } = require('../utils/jwt');
const {
  sendEmailVerificationCodeEmail,
  sendPasswordVerificationCodeEmail,
  sendPasswordResetSuccess,
  sendWelcomeEmail,
  sendApprovalEmail,
} = require('./email.service');
const { sendPhoneOtp, verifyPhoneOtp } = require('./twilioVerify.service');

const PASSWORD_RESET_PURPOSE = 'PASSWORD_RESET';
const PASSWORD_CHANGE_PURPOSE = 'PASSWORD_CHANGE';
const EMAIL_VERIFICATION_PURPOSE = 'EMAIL_VERIFICATION';
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeCode = (value) => String(value || '').trim();
const isE164 = (value) => /^\+\d{7,15}$/.test(String(value || '').trim());
const hashCode = (code) => crypto.createHash('sha256').update(normalizeCode(code)).digest('hex');
const makeCode = () => String(crypto.randomInt(100000, 1000000));
const codesMatch = (stored, candidate) => {
  const a = Buffer.from(String(stored || ''), 'utf8');
  const b = Buffer.from(hashCode(candidate), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const viewUser = (user) => {
  const data = user?.toObject ? user.toObject() : { ...(user || {}) };
  delete data.password;
  return { ...data, id: data._id?.toString?.() || data.id };
};

const tokenFor = (user) => generateToken({ userId: user._id.toString(), email: user.email, role: user.role });
const passwordIsAcceptable = (password) => typeof password === 'string' && password.length >= 8;

const issueVerificationCode = async (user, purpose, { enforceCooldown = true } = {}) => {
  if (!user?.email) throw new Error('This account does not have an email address for verification');
  const email = normalizeEmail(user.email);
  if (enforceCooldown) {
    const latest = await PasswordReset.findOne({ email, purpose, isUsed: false }).sort({ createdAt: -1 }).select('createdAt');
    if (latest?.createdAt && Date.now() - new Date(latest.createdAt).getTime() < RESEND_COOLDOWN_MS) {
      const error = new Error('Please wait one minute before requesting another code');
      error.statusCode = 429;
      throw error;
    }
  }
  const code = makeCode();
  await PasswordReset.deleteMany({ email, purpose, isUsed: false });
  const record = await PasswordReset.create({
    userId: user._id,
    email,
    purpose,
    code: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  try {
    const delivery = purpose === EMAIL_VERIFICATION_PURPOSE
      ? await sendEmailVerificationCodeEmail({ name: user.fullName, email, code })
      : await sendPasswordVerificationCodeEmail({
        name: user.fullName,
        email,
        code,
        purpose: purpose === PASSWORD_CHANGE_PURPOSE ? 'change' : 'reset',
      });
    if (delivery?.skipped) throw new Error('Email delivery is not configured. Please contact support.');
  } catch (error) {
    await PasswordReset.deleteOne({ _id: record._id });
    throw new Error(error?.message || 'Unable to send verification code');
  }
};

const findValidCode = async ({ email, purpose, code, userId = null }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !/^\d{6}$/.test(normalizeCode(code))) return null;
  const query = { email: normalizedEmail, purpose, isUsed: false, expiresAt: { $gt: new Date() } };
  if (userId) query.userId = userId;
  const record = await PasswordReset.findOne(query).sort({ createdAt: -1 });
  if (!record) return null;
  const maxAttempts = Number(record.maxAttempts || 5);
  if (Number(record.attempts || 0) >= maxAttempts) {
    record.isUsed = true;
    await record.save();
    return null;
  }
  if (codesMatch(record.code, code)) return record;
  record.attempts = Number(record.attempts || 0) + 1;
  if (record.attempts >= maxAttempts) record.isUsed = true;
  await record.save();
  return null;
};

const queueWelcomeOnce = async (user) => {
  const claimed = await User.findOneAndUpdate(
    { _id: user._id, welcomeEmailSentAt: null },
    { $set: { welcomeEmailSentAt: new Date() } },
    { new: true },
  );
  if (claimed) await sendWelcomeEmail({ user: claimed });
};

/**
 * Register a user.
 *
 * Patient accounts still need to verify before they can create a session.
 * Professional accounts can enter their setup/dashboard while their profile
 * and documents are being reviewed, but their email address must be verified
 * independently from that approval workflow.
 */
const registerUser = async (data) => {
  const normalizedRole = String(data?.role || '').toUpperCase();
  const email = normalizeEmail(data?.email);
  const fullName = String(data?.fullName || '').trim();
  const isPharmacy = ['PHARMACY', 'PARAPHARMACY'].includes(normalizedRole);
  const requiresEmailVerification = ['PATIENT', 'DOCTOR', 'PHARMACY', 'PARAPHARMACY'].includes(normalizedRole);
  if (!email || !fullName) throw new Error('Full name and email address are required');
  if (isPharmacy && !isE164(data.phone)) throw new Error('Phone number must be in international format (E.164), e.g. +1234567890');

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === 'PATIENT' && existing.emailVerificationRequired && !existing.isEmailVerified) {
      await issueVerificationCode(existing, EMAIL_VERIFICATION_PURPOSE);
      return { requiresEmailVerification: true, email: existing.email, user: viewUser(existing) };
    }
    const error = new Error('Email already registered');
    error.statusCode = 409;
    throw error;
  }

  if (normalizedRole === 'DOCTOR' && data.specializationId) {
    const specialization = await Specialization.findById(data.specializationId);
    if (!specialization) throw new Error('Invalid specialization. Please select a specialization from the list.');
  }

  const user = await User.create({
    email,
    password: data.password,
    fullName,
    role: normalizedRole,
    phone: data.phone ? String(data.phone).trim() : null,
    gender: data.gender || null,
    dob: data.dob ? new Date(data.dob) : null,
    profileImage: data.profileImage || null,
    status: requiresEmailVerification ? 'PENDING' : normalizedRole === 'PATIENT' ? 'APPROVED' : 'PENDING',
    isPhoneVerified: false,
    isEmailVerified: false,
    emailVerificationRequired: requiresEmailVerification,
  });

  try {
    if (normalizedRole === 'DOCTOR' && data.specializationId) {
      const doctorProfile = await DoctorProfile.create({ userId: user._id, specialization: data.specializationId });
      user.doctorProfile = doctorProfile._id;
      await user.save();
    }
    if (isPharmacy) await sendPhoneOtp(user.phone);
    if (requiresEmailVerification) {
      await issueVerificationCode(user, EMAIL_VERIFICATION_PURPOSE, { enforceCooldown: false });
      // Only patients are held at the email screen. Professionals retain a
      // session so they can complete onboarding and see the dashboard banner.
      if (normalizedRole === 'PATIENT') {
        return { requiresEmailVerification: true, email: user.email, user: viewUser(user) };
      }
      return {
        user: viewUser(user),
        token: tokenFor(user),
        emailVerificationRequired: true,
        verificationEmailSent: true,
      };
    }
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw new Error(error?.message || 'Unable to complete registration');
  }

  return { user: viewUser(user), token: tokenFor(user) };
};

const verifyEmail = async (email, code) => {
  const record = await findValidCode({ email, purpose: EMAIL_VERIFICATION_PURPOSE, code });
  if (!record) throw new Error('Invalid or expired verification code');
  const user = await User.findById(record.userId);
  if (!user || !['PATIENT', 'DOCTOR', 'PHARMACY', 'PARAPHARMACY'].includes(user.role) || !user.emailVerificationRequired) {
    throw new Error('Account not found');
  }
  user.isEmailVerified = true;
  user.emailVerificationRequired = false;
  // Email verification is not administrator approval. Only patients become
  // approved here; doctors and businesses remain pending until documents are
  // reviewed by an administrator.
  if (user.role === 'PATIENT') user.status = 'APPROVED';
  record.isUsed = true;
  await Promise.all([user.save(), record.save()]);
  await queueWelcomeOnce(user).catch((error) => console.error('[email] welcome email queue failed:', error.message));
  return { user: viewUser(user), token: tokenFor(user) };
};

const resendEmailVerification = async (email) => {
  const user = await User.findOne({ email: normalizeEmail(email) });
  // Keep this endpoint non-enumerating.
  if (!user || !['PATIENT', 'DOCTOR', 'PHARMACY', 'PARAPHARMACY'].includes(user.role) || user.isEmailVerified) return;
  // Professional accounts created before email verification was introduced
  // have no requirement flag. Activating it here lets them verify from their
  // dashboard without changing their approval status or login access.
  if (!user.emailVerificationRequired) {
    user.emailVerificationRequired = true;
    await user.save();
  }
  await issueVerificationCode(user, EMAIL_VERIFICATION_PURPOSE);
};

const sendPhoneOtpForUser = async (userId, phone = null) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (!['PHARMACY', 'PARAPHARMACY'].includes(user.role)) throw new Error('Phone verification is only available for pharmacy accounts');
  const targetPhone = String(phone || user.phone || '').trim();
  if (!isE164(targetPhone)) throw new Error('Phone number must be in international format (E.164), e.g. +1234567890');
  if (user.phone !== targetPhone) { user.phone = targetPhone; await user.save(); }
  const result = await sendPhoneOtp(targetPhone);
  return { status: result.status };
};

const verifyPhoneOtpForUser = async (userId, code, phone = null) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  if (!['PHARMACY', 'PARAPHARMACY'].includes(user.role)) throw new Error('Phone verification is only available for pharmacy accounts');
  const targetPhone = String(phone || user.phone || '').trim();
  if (!isE164(targetPhone)) throw new Error('Phone number must be in international format (E.164), e.g. +1234567890');
  const result = await verifyPhoneOtp(targetPhone, normalizeCode(code));
  if (String(result.status || '').toLowerCase() !== 'approved') throw new Error('Invalid verification code');
  user.isPhoneVerified = true;
  user.phone = targetPhone;
  await user.save();
  return { verified: true, user: viewUser(user) };
};

const approvePharmacy = async (pharmacyUserId) => {
  const user = await User.findById(pharmacyUserId);
  if (!user) throw new Error('Pharmacy user not found');
  if (!['PHARMACY', 'PARAPHARMACY'].includes(user.role)) throw new Error('User is not a pharmacy');
  const required = ['PHARMACY_LICENSE', 'PHARMACY_DEGREE'];
  const provided = new Set((Array.isArray(user.documentUploads) ? user.documentUploads : []).map((entry) => String(entry.type || '').toUpperCase()));
  const missing = required.filter((item) => !provided.has(item));
  if (missing.length) throw new Error(`Missing required pharmacy documents: ${missing.join(', ')}`);
  user.isPharmacyDocumentsVerified = true;
  user.status = 'APPROVED';
  await user.save();
  await sendApprovalEmail({ user, role: user.role }).catch((error) => console.error('[email] pharmacy approval queue failed:', error.message));
  return user;
};

const approveDoctor = async (doctorId) => {
  const user = await User.findById(doctorId);
  if (!user) throw new Error('Doctor not found');
  if (user.role !== 'DOCTOR') throw new Error('User is not a doctor');
  user.status = 'APPROVED';
  user.isDoctorDocumentsVerified = true;
  await user.save();
  await sendApprovalEmail({ user, role: 'DOCTOR' }).catch((error) => console.error('[email] doctor approval queue failed:', error.message));
  return user;
};

const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email: normalizeEmail(email) }).select('+password');
  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) throw new Error('Invalid email or password');
  if (['BLOCKED', 'REJECTED'].includes(user.status)) throw new Error('Account is blocked or rejected');
  if (user.role === 'PATIENT' && user.emailVerificationRequired && !user.isEmailVerified) {
    const error = new Error('Please verify your email address before logging in');
    error.statusCode = 403;
    throw error;
  }
  await queueWelcomeOnce(user).catch((error) => console.error('[email] welcome email queue failed:', error.message));
  const message = user.status === 'PENDING'
    ? user.role === 'DOCTOR'
      ? 'Your account is pending admin approval. You can complete your profile, but you will not be visible to patients until approved.'
      : 'Your account is pending admin approval. Please upload verification documents and wait for approval.'
    : undefined;
  return { user: viewUser(user), token: tokenFor(user), ...(message ? { message } : {}) };
};

const requestPasswordReset = async (email) => {
  const user = await User.findOne({ email: normalizeEmail(email) });
  // Do not reveal whether an account exists.
  if (!user) return { message: 'If the address belongs to an account, a verification code has been sent.' };
  await issueVerificationCode(user, PASSWORD_RESET_PURPOSE);
  return { message: 'If the address belongs to an account, a verification code has been sent.' };
};

const verifyPasswordResetCode = async (email, code) => {
  const record = await findValidCode({ email, purpose: PASSWORD_RESET_PURPOSE, code });
  if (!record) throw new Error('Invalid or expired verification code');
  record.verifiedAt = new Date();
  await record.save();
  return { verified: true };
};

const resetPassword = async (email, code, newPassword) => {
  if (!passwordIsAcceptable(newPassword)) throw new Error('New password must be at least 8 characters long');
  const user = await User.findOne({ email: normalizeEmail(email) }).select('+password');
  const record = user && await findValidCode({ email, purpose: PASSWORD_RESET_PURPOSE, code, userId: user._id });
  if (!user || !record || !record.verifiedAt) throw new Error('Invalid or expired verification code. Please request a new code.');
  user.password = newPassword;
  record.isUsed = true;
  await Promise.all([user.save(), record.save()]);
  await sendPasswordResetSuccess({ email: user.email, name: user.fullName }).catch((error) => console.error('[email] reset success queue failed:', error.message));
  return { message: 'Password reset successfully' };
};

const requestChangePasswordCode = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  await issueVerificationCode(user, PASSWORD_CHANGE_PURPOSE);
};

const verifyChangePasswordCode = async (userId, code) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');
  const record = await findValidCode({ email: user.email, purpose: PASSWORD_CHANGE_PURPOSE, code, userId });
  if (!record) throw new Error('Invalid or expired verification code');
  record.verifiedAt = new Date();
  await record.save();
  return { verified: true };
};

const changePassword = async (userId, newPassword, code) => {
  if (!passwordIsAcceptable(newPassword)) throw new Error('New password must be at least 8 characters long');
  const user = await User.findById(userId).select('+password');
  if (!user) throw new Error('User not found');
  const record = await findValidCode({ email: user.email, purpose: PASSWORD_CHANGE_PURPOSE, code, userId });
  if (!record || !record.verifiedAt) throw new Error('Verify the emailed code before changing your password');
  user.password = newPassword;
  record.isUsed = true;
  await Promise.all([user.save(), record.save()]);
  await sendPasswordResetSuccess({ email: user.email, name: user.fullName }).catch((error) => console.error('[email] password change queue failed:', error.message));
  return { message: 'Password changed successfully' };
};

const refreshToken = async (token) => {
  const { verifyToken } = require('../utils/jwt');
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);
    if (!user) throw new Error('User not found');
    return { token: tokenFor(user) };
  } catch (_) { throw new Error('Invalid refresh token'); }
};

module.exports = {
  registerUser, verifyEmail, resendEmailVerification, loginUser, approveDoctor, approvePharmacy,
  changePassword, requestChangePasswordCode, verifyChangePasswordCode, refreshToken,
  requestPasswordReset, verifyPasswordResetCode, resetPassword, sendPhoneOtpForUser, verifyPhoneOtpForUser,
};
