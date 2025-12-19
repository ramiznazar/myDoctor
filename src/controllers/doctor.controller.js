const asyncHandler = require('../middleware/asyncHandler');
const doctorService = require('../services/doctor.service');

/**
 * Upsert doctor profile (create or update)
 */
exports.upsertProfile = asyncHandler(async (req, res) => {
  const result = await doctorService.upsertDoctorProfile(req.userId, req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get doctor profile (uses token for authenticated doctors)
 */
exports.getProfile = asyncHandler(async (req, res) => {
  // If user is authenticated doctor, use their ID from token
  const userId = req.userId;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID is required' });
  }
  const result = await doctorService.getDoctorProfile(userId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get doctor profile by user ID (public access)
 */
exports.getProfileById = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const result = await doctorService.getDoctorProfile(userId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List doctors with filtering
 */
exports.listDoctors = asyncHandler(async (req, res) => {
  const result = await doctorService.listDoctors(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Doctor buys a subscription plan
 */
exports.buySubscriptionPlan = asyncHandler(async (req, res) => {
  const result = await doctorService.buySubscriptionPlan(req.userId, req.body.planId);
  res.json({ success: true, message: 'Subscription plan purchased successfully', data: result });
});

/**
 * Get doctor's current subscription plan
 */
exports.getMySubscriptionPlan = asyncHandler(async (req, res) => {
  const result = await doctorService.getMySubscriptionPlan(req.userId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get doctor dashboard statistics
 */
exports.getDashboard = asyncHandler(async (req, res) => {
  const result = await doctorService.getDoctorDashboard(req.userId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get doctor's reviews
 */
exports.getReviews = asyncHandler(async (req, res) => {
  const result = await doctorService.getDoctorReviews(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

