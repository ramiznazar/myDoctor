const express = require('express');
const router = express.Router();
const { uploadSingleImage, uploadMultipleImages, uploadSingleChatFile, uploadMultipleChatFiles } = require('../middleware/upload.middleware');
const uploadController = require('../controllers/upload.controller');
const authGuard = require('../middleware/authGuard');
const requirePhoneVerified = require('../middleware/requirePhoneVerified');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/upload/profile
 * @desc    Upload user profile image
 * @access  Private (Admin, Doctor, Patient)
 */
router.post(
  '/profile',
  authGuard(['ADMIN', 'DOCTOR', 'PATIENT', 'PHARMACY', 'PARAPHARMACY']),
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

router.post(
  '/pharmacy-docs',
  authGuard(['PHARMACY', 'PARAPHARMACY']),
  requirePhoneVerified(),
  uploadMultipleChatFiles('pharmacyDocs', 10),
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
 * @access  Private (Admin, Pharmacy)
 */
router.post(
  '/product',
  authGuard(['ADMIN', 'PHARMACY', 'PARAPHARMACY']),
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
  authGuard(['PHARMACY', 'PARAPHARMACY', 'ADMIN']),
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
  authGuard(['ADMIN', 'DOCTOR', 'PATIENT', 'PHARMACY', 'PARAPHARMACY']),
  uploadSingleImage('general'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/chat
 * @desc    Upload file for chat (supports all file types - images, PDFs, documents, etc.)
 * @access  Private (Admin, Doctor, Patient)
 */
router.post(
  '/chat',
  authGuard(['ADMIN', 'DOCTOR', 'PATIENT']),
  uploadSingleChatFile('chat'),
  asyncHandler(uploadController.uploadSingleFile)
);

/**
 * @route   POST /api/upload/chat/multiple
 * @desc    Upload multiple files for chat (supports all file types)
 * @access  Private (Admin, Doctor, Patient)
 */
router.post(
  '/chat/multiple',
  authGuard(['ADMIN', 'DOCTOR', 'PATIENT']),
  uploadMultipleChatFiles('chat', 10),
  asyncHandler(uploadController.uploadMultipleFiles)
);

module.exports = router;

