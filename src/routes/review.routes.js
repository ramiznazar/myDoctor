const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');
const { createReviewValidator } = require('../validators/review.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/reviews
 * @desc    Create review
 * @access  Private (Patient)
 */
router.post(
  '/',
  authGuard(['PATIENT']),
  validate(createReviewValidator),
  asyncHandler(reviewController.create)
);

/**
 * @route   GET /api/reviews/doctor/:doctorId
 * @desc    List reviews by doctor
 * @access  Public
 */
router.get(
  '/doctor/:doctorId',
  asyncHandler(reviewController.listByDoctor)
);

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete review
 * @access  Private (Patient/Admin)
 */
router.delete(
  '/:id',
  authGuard(['PATIENT', 'ADMIN']),
  asyncHandler(reviewController.delete)
);

module.exports = router;

