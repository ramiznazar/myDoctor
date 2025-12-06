const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const { upsertDoctorProfileValidator } = require('../validators/doctor.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   PUT /api/doctor/profile
 * @desc    Upsert doctor profile (create or update)
 * @access  Private (Doctor)
 */
router.put(
  '/profile',
  authGuard(['DOCTOR']),
  validate(upsertDoctorProfileValidator),
  asyncHandler(doctorController.upsertProfile)
);

/**
 * @route   GET /api/doctor/profile/:id
 * @desc    Get doctor profile by user ID
 * @access  Public
 */
router.get(
  '/profile/:id',
  asyncHandler(doctorController.getProfile)
);

/**
 * @route   GET /api/doctor
 * @desc    List doctors with filtering
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(doctorController.listDoctors)
);

module.exports = router;

