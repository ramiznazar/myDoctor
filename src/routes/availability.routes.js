const express = require('express');
const router = express.Router();
const availabilityController = require('../controllers/availability.controller');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/availability
 * @desc    Set doctor availability
 * @access  Private (Doctor)
 */
router.post(
  '/',
  authGuard(['DOCTOR']),
  asyncHandler(availabilityController.setAvailability)
);

/**
 * @route   GET /api/availability
 * @desc    Get doctor availability
 * @access  Private (Doctor)
 */
router.get(
  '/',
  authGuard(['DOCTOR']),
  asyncHandler(availabilityController.getAvailability)
);

/**
 * @route   GET /api/availability/slots
 * @desc    Get available time slots (public)
 * @access  Public
 */
router.get(
  '/slots',
  asyncHandler(availabilityController.getAvailableSlots)
);

/**
 * @route   GET /api/availability/check
 * @desc    Check time slot availability (public)
 * @access  Public
 */
router.get(
  '/check',
  asyncHandler(availabilityController.checkTimeSlot)
);

module.exports = router;












