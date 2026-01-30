const SubscriptionPlan = require('../models/subscriptionPlan.model');
const subscriptionPolicy = require('./subscriptionPolicy.service');

/**
 * Create subscription plan
 * @param {Object} data - Plan data
 * @returns {Promise<Object>} Created plan
 */
const createPlan = async () => {
  const error = new Error('Subscription plans are fixed. Admin can only update plan prices.');
  error.statusCode = 403;
  throw error;
};

/**
 * Get all subscription plans
 * @param {Object} filter - Filter options
 * @returns {Promise<Array>} List of subscription plans
 */
const getAllPlans = async (filter = {}) => {
  await subscriptionPolicy.ensureFixedPlansExist();

  const query = {
    name: { $in: subscriptionPolicy.FIXED_PLAN_NAMES }
  };

  if (filter.status) {
    query.status = filter.status.toUpperCase();
  }

  const plans = await SubscriptionPlan.find(query).sort({ price: 1 });
  return plans.map(subscriptionPolicy.attachPolicyToPlan);
};

/**
 * Get all active subscription plans (for doctors to view available plans)
 * @returns {Promise<Array>} List of active subscription plans
 */
const getActivePlans = async () => {
  await subscriptionPolicy.ensureFixedPlansExist();

  const plans = await SubscriptionPlan.find({
    name: { $in: subscriptionPolicy.FIXED_PLAN_NAMES },
    status: 'ACTIVE'
  }).sort({ price: 1 });

  return plans.map(subscriptionPolicy.attachPolicyToPlan);
};

/**
 * Get subscription plan by ID
 * @param {string} id - Plan ID
 * @returns {Promise<Object>} Subscription plan
 */
const getPlanById = async (id) => {
  await subscriptionPolicy.ensureFixedPlansExist();

  const plan = await SubscriptionPlan.findById(id);
 
  if (!plan) {
    const error = new Error('Subscription plan not found');
    error.statusCode = 404;
    throw error;
  }

  const normalizedName = subscriptionPolicy.normalizePlanName(plan.name);
  if (!subscriptionPolicy.FIXED_PLAN_NAMES.includes(normalizedName)) {
    const error = new Error('Subscription plan not found');
    error.statusCode = 404;
    throw error;
  }

  return subscriptionPolicy.attachPolicyToPlan(plan);
};

/**
 * Update subscription plan
 * @param {string} id - Plan ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated subscription plan
 */
const updatePlan = async (id, data) => {
  await subscriptionPolicy.ensureFixedPlansExist();

  const plan = await SubscriptionPlan.findById(id);
 
  if (!plan) {
    const error = new Error('Subscription plan not found');
    error.statusCode = 404;
    throw error;
  }

  const normalizedName = subscriptionPolicy.normalizePlanName(plan.name);
  if (!subscriptionPolicy.FIXED_PLAN_NAMES.includes(normalizedName)) {
    const error = new Error('Subscription plan not found');
    error.statusCode = 404;
    throw error;
  }

  const allowedKeys = ['price'];
  const providedKeys = Object.keys(data || {});
  const hasDisallowed = providedKeys.some((k) => !allowedKeys.includes(k));
  if (hasDisallowed) {
    const error = new Error('Admin can only update plan price');
    error.statusCode = 403;
    throw error;
  }

  if (data.price === undefined) {
    const error = new Error('Price is required');
    error.statusCode = 400;
    throw error;
  }

  plan.price = data.price;
  await plan.save();

  return subscriptionPolicy.attachPolicyToPlan(plan);
};

/**
 * Delete subscription plan
 * @param {string} id - Plan ID
 * @returns {Promise<Object>} Success message
 */
const deletePlan = async () => {
  const error = new Error('Subscription plans are fixed and cannot be deleted');
  error.statusCode = 403;
  throw error;
};

module.exports = {
  createPlan,
  getAllPlans,
  getActivePlans,
  getPlanById,
  updatePlan,
  deletePlan
};


