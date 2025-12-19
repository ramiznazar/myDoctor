const asyncHandler = require('../middleware/asyncHandler');
const reviewService = require('../services/review.service');

/**
 * Create review
 * Supports both overall doctor review and per-appointment review
 */
exports.create = asyncHandler(async (req, res) => {
  const reviewData = {
    ...req.body,
    patientId: req.userId // Always use patientId from token
  };
  const result = await reviewService.createReview(reviewData);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List reviews by doctor
 */
exports.listByDoctor = asyncHandler(async (req, res) => {
  const result = await reviewService.listReviewsByDoctor(req.params.doctorId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Delete review
 */
exports.delete = asyncHandler(async (req, res) => {
  const result = await reviewService.deleteReview(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

