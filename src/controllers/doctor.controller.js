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
 * Get doctor profile by user ID
 */
exports.getProfile = asyncHandler(async (req, res) => {
  const userId = req.params.id || req.userId;
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

