const asyncHandler = require('../middleware/asyncHandler');
const subscriptionPlanService = require('../services/subscriptionPlan.service');

/**
 * Create subscription plan
 */
exports.createPlan = asyncHandler(async (req, res) => {
  const result = await subscriptionPlanService.createPlan(req.body);
  res.json({ success: true, message: 'Subscription plan created successfully', data: result });
});

/**
 * Get all subscription plans
 */
exports.getAllPlans = asyncHandler(async (req, res) => {
  const result = await subscriptionPlanService.getAllPlans(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get all active subscription plans (for doctors)
 */
exports.getActivePlans = asyncHandler(async (req, res) => {
  const result = await subscriptionPlanService.getActivePlans();
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get subscription plan by ID
 */
exports.getPlanById = asyncHandler(async (req, res) => {
  const result = await subscriptionPlanService.getPlanById(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update subscription plan
 */
exports.updatePlan = asyncHandler(async (req, res) => {
  const result = await subscriptionPlanService.updatePlan(req.params.id, req.body);
  res.json({ success: true, message: 'Subscription plan updated successfully', data: result });
});

/**
 * Delete subscription plan
 */
exports.deletePlan = asyncHandler(async (req, res) => {
  const result = await subscriptionPlanService.deletePlan(req.params.id);
  res.json({ success: true, message: result.message, data: null });
});








