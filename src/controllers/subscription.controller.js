const asyncHandler = require('../middleware/asyncHandler');
const subscriptionService = require('../services/subscription.service');

/**
 * Create subscription plan
 */
exports.createPlan = asyncHandler(async (req, res) => {
  const result = await subscriptionService.createPlan(req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update subscription plan
 */
exports.updatePlan = asyncHandler(async (req, res) => {
  const result = await subscriptionService.updatePlan(req.params.id, req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Assign subscription to doctor
 */
exports.assignToDoctor = asyncHandler(async (req, res) => {
  const { doctorId, planId } = req.body;
  const result = await subscriptionService.assignToDoctor(doctorId, planId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List subscription plans
 */
exports.listPlans = asyncHandler(async (req, res) => {
  const result = await subscriptionService.listPlans(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

