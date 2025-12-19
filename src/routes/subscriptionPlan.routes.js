const express = require('express');
const router = express.Router();
const subscriptionPlanController = require('../controllers/subscriptionPlan.controller');
const {
  subscriptionPlanCreateValidator,
  subscriptionPlanUpdateValidator
} = require('../validators/subscriptionPlan.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /admin/subscription-plan
 * @desc    Create subscription plan
 * @access  Private (Admin only)
 */
router.post(
  '/',
  authGuard(['ADMIN']),
  validate(subscriptionPlanCreateValidator),
  asyncHandler(subscriptionPlanController.createPlan)
);

/**
 * @route   GET /admin/subscription-plan/active
 * @desc    Get all active subscription plans (for doctors to view available plans)
 * @access  Public (No authentication required)
 */
router.get(
  '/active',
  asyncHandler(subscriptionPlanController.getActivePlans)
);

/**
 * @route   GET /admin/subscription-plan
 * @desc    Get all subscription plans
 * @access  Private (Admin only)
 */
router.get(
  '/',
  authGuard(['ADMIN']),
  asyncHandler(subscriptionPlanController.getAllPlans)
);

/**
 * @route   GET /admin/subscription-plan/:id
 * @desc    Get subscription plan by ID
 * @access  Private (Admin only)
 */
router.get(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(subscriptionPlanController.getPlanById)
);

/**
 * @route   PUT /admin/subscription-plan/:id
 * @desc    Update subscription plan
 * @access  Private (Admin only)
 */
router.put(
  '/:id',
  authGuard(['ADMIN']),
  validate(subscriptionPlanUpdateValidator),
  asyncHandler(subscriptionPlanController.updatePlan)
);

/**
 * @route   DELETE /admin/subscription-plan/:id
 * @desc    Delete subscription plan
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(subscriptionPlanController.deletePlan)
);

module.exports = router;






























