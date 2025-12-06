const Review = require('../models/review.model');
const doctorService = require('./doctor.service');

/**
 * Create review
 * @param {Object} data - Review data
 * @returns {Promise<Object>} Created review
 */
const createReview = async (data) => {
  const { doctorId, patientId, rating, reviewText } = data;

  // Check if patient already reviewed this doctor
  const existingReview = await Review.findOne({ doctorId, patientId });
  if (existingReview) {
    throw new Error('You have already reviewed this doctor');
  }

  const review = await Review.create({
    doctorId,
    patientId,
    rating,
    reviewText
  });

  // Update doctor rating after review is created
  await doctorService.updateDoctorRating(doctorId);

  return review;
};

/**
 * List reviews by doctor
 * @param {string} doctorId - Doctor ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Reviews and pagination info
 */
const listReviewsByDoctor = async (doctorId, options = {}) => {
  const { page = 1, limit = 10 } = options;

  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find({ doctorId })
      .populate('patientId', 'fullName profileImage')
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

/**
 * Delete review
 * @param {string} id - Review ID
 * @returns {Promise<Object>} Success message
 */
const deleteReview = async (id) => {
  const review = await Review.findById(id);
  
  if (!review) {
    throw new Error('Review not found');
  }

  const doctorId = review.doctorId;

  await Review.findByIdAndDelete(id);

  // Recalculate doctor rating after review deletion
  await doctorService.updateDoctorRating(doctorId);

  return { message: 'Review deleted successfully' };
};

module.exports = {
  createReview,
  listReviewsByDoctor,
  deleteReview
};

