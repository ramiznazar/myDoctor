const express = require('express');
const router = express.Router();
const mappingController = require('../controllers/mapping.controller');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/mapping/route
 * @desc    Get route from patient to clinic
 * @access  Public
 */
router.get(
  '/route',
  asyncHandler(mappingController.getRoute)
);

/**
 * @route   GET /api/mapping/nearby
 * @desc    Get nearby clinics
 * @access  Public
 */
router.get(
  '/nearby',
  asyncHandler(mappingController.getNearbyClinics)
);

/**
 * @route   GET /api/mapping/clinic/:id
 * @desc    Get clinic location by ID
 * @access  Public
 */
router.get(
  '/clinic/:id',
  asyncHandler(mappingController.getClinicLocation)
);

module.exports = router;












