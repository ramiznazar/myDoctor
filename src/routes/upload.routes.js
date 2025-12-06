const express = require('express');
const router = express.Router();
const { uploadSingleImage, uploadMultipleImages } = require('../middleware/upload.middleware');
const uploadController = require('../controllers/upload.controller');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/upload/profile
 * @desc    Upload user profile image
 * @access  Private (Admin, Doctor, Patient)
 */
router.post(
  '/profile',
  authGuard(['ADMIN', 'DOCTOR', 'PATIENT']),
  uploadSingleImage('profile'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/doctor-docs
 * @desc    Upload doctor documents
 * @access  Private (Doctor)
 */
router.post(
  '/doctor-docs',
  authGuard(['DOCTOR']),
  uploadMultipleImages('doctorDocs', 5),
  asyncHandler(uploadController.uploadMultipleFiles)
);

/**
 * @route   POST /api/upload/clinic
 * @desc    Upload clinic images
 * @access  Private (Doctor)
 */
router.post(
  '/clinic',
  authGuard(['DOCTOR']),
  uploadMultipleImages('clinic', 10),
  asyncHandler(uploadController.uploadMultipleFiles)
);

/**
 * @route   POST /api/upload/product
 * @desc    Upload product images
 * @access  Private (Doctor, Pharmacy)
 */
router.post(
  '/product',
  authGuard(['DOCTOR', 'PHARMACY']),
  uploadMultipleImages('product', 10),
  asyncHandler(uploadController.uploadMultipleFiles)
);

/**
 * @route   POST /api/upload/blog
 * @desc    Upload blog cover image
 * @access  Private (Admin, Doctor)
 */
router.post(
  '/blog',
  authGuard(['ADMIN', 'DOCTOR']),
  uploadSingleImage('blog'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/pharmacy
 * @desc    Upload pharmacy logo
 * @access  Private (Pharmacy, Admin)
 */
router.post(
  '/pharmacy',
  authGuard(['PHARMACY', 'ADMIN']),
  uploadSingleImage('pharmacy'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/general
 * @desc    Upload general images
 * @access  Private (Admin, Doctor, Patient)
 */
router.post(
  '/general',
  authGuard(['ADMIN', 'DOCTOR', 'PATIENT']),
  uploadSingleImage('general'),
  asyncHandler(uploadController.uploadSingleFile)
);

module.exports = router;

