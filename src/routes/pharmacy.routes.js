const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacy.controller');
const {
  createPharmacyValidator,
  updatePharmacyValidator,
  buySubscriptionPlanValidator
} = require('../validators/pharmacy.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/pharmacy
 * @desc    Create pharmacy
 * @access  Private (Admin, Pharmacy)
 */
router.post(
  '/',
  authGuard(['ADMIN', 'PHARMACY']),
  validate(createPharmacyValidator),
  asyncHandler(pharmacyController.create)
);

/**
 * @route   PUT /api/pharmacy/:id
 * @desc    Update pharmacy
 * @access  Private (Admin, Pharmacy - can only update their own pharmacy)
 */
router.put(
  '/:id',
  authGuard(['ADMIN', 'PHARMACY']),
  validate(updatePharmacyValidator),
  asyncHandler(pharmacyController.update)
);

/**
 * @route   GET /api/pharmacy/me
 * @desc    Get my pharmacy profile
 * @access  Private (Pharmacy)
 */
router.get(
  '/me',
  authGuard(['PHARMACY']),
  asyncHandler(pharmacyController.getMyPharmacy)
);

/**
 * @route   POST /api/pharmacy/buy-subscription
 * @desc    Pharmacy buys a subscription plan
 * @access  Private (Pharmacy)
 */
router.post(
  '/buy-subscription',
  authGuard(['PHARMACY']),
  validate(buySubscriptionPlanValidator),
  asyncHandler(pharmacyController.buySubscriptionPlan)
);

/**
 * @route   GET /api/pharmacy/my-subscription
 * @desc    Get pharmacy's current subscription plan
 * @access  Private (Pharmacy)
 */
router.get(
  '/my-subscription',
  authGuard(['PHARMACY']),
  asyncHandler(pharmacyController.getMySubscriptionPlan)
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

