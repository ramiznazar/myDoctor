const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscription.controller');
const {
  createSubscriptionPlanValidator,
  updateSubscriptionPlanValidator,
  assignSubscriptionToDoctorValidator
} = require('../validators/subscription.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/subscription
 * @desc    Create subscription plan
 * @access  Private (Admin)
 */
router.post(
  '/',
  authGuard(['ADMIN']),
  validate(createSubscriptionPlanValidator),
  asyncHandler(subscriptionController.createPlan)
);

/**
 * @route   PUT /api/subscription/:id
 * @desc    Update subscription plan
 * @access  Private (Admin)
 */
router.put(
  '/:id',
  authGuard(['ADMIN']),
  validate(updateSubscriptionPlanValidator),
  asyncHandler(subscriptionController.updatePlan)
);

/**
 * @route   POST /api/subscription/assign
 * @desc    Assign subscription to doctor
 * @access  Private (Admin)
 */
router.post(
  '/assign',
  authGuard(['ADMIN']),
  validate(assignSubscriptionToDoctorValidator),
  asyncHandler(subscriptionController.assignToDoctor)
);

/**
 * @route   GET /api/subscription
 * @desc    List subscription plans
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(subscriptionController.listPlans)
);

module.exports = router;

