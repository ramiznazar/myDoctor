const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacy.controller');
const {
  createPharmacyValidator,
  updatePharmacyValidator
} = require('../validators/pharmacy.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/pharmacy
 * @desc    Create pharmacy
 * @access  Private (Admin)
 */
router.post(
  '/',
  authGuard(['ADMIN']),
  validate(createPharmacyValidator),
  asyncHandler(pharmacyController.create)
);

/**
 * @route   PUT /api/pharmacy/:id
 * @desc    Update pharmacy
 * @access  Private (Admin)
 */
router.put(
  '/:id',
  authGuard(['ADMIN']),
  validate(updatePharmacyValidator),
  asyncHandler(pharmacyController.update)
);

/**
 * @route   GET /api/pharmacy
 * @desc    List pharmacies with filtering
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(pharmacyController.list)
);

/**
 * @route   GET /api/pharmacy/:id
 * @desc    Get pharmacy by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(pharmacyController.getById)
);

/**
 * @route   DELETE /api/pharmacy/:id
 * @desc    Delete pharmacy
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(pharmacyController.delete)
);

module.exports = router;

