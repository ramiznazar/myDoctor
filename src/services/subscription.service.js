const SubscriptionPlan = require('../models/subscriptionPlan.model');
const User = require('../models/user.model');
const subscriptionPolicy = require('./subscriptionPolicy.service');

/**
 * Create subscription plan
 * @param {Object} data - Plan data
 * @returns {Promise<Object>} Created plan
 */
const createPlan = async (data) => {
  const error = new Error('Subscription plans are fixed. Admin can only update plan prices.');
  error.statusCode = 403;
  throw error;
};

/**
 * Update subscription plan
 * @param {string} id - Plan ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated plan
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
 * Assign subscription plan to doctor
 * @param {string} doctorId - Doctor user ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Updated user
 */
const assignToDoctor = async (doctorId, planId) => {
  await subscriptionPolicy.ensureFixedPlansExist();

  const user = await User.findById(doctorId);
  
  if (!user) {
    throw new Error('User not found');
  }

  if (user.role !== 'DOCTOR') {
    throw new Error('User is not a doctor');
  }

  const plan = await SubscriptionPlan.findById(planId);
  
  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  const normalizedName = subscriptionPolicy.normalizePlanName(plan.name);
  if (!subscriptionPolicy.FIXED_PLAN_NAMES.includes(normalizedName)) {
    const error = new Error('Invalid subscription plan');
    error.statusCode = 400;
    throw error;
  }

  if (plan.status !== 'ACTIVE') {
    const error = new Error('Subscription plan is not active');
    error.statusCode = 403;
    throw error;
  }

  // Update user subscription
  user.subscriptionPlan = planId;
  
  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + plan.durationInDays);
  user.subscriptionExpiresAt = expiresAt;

  await user.save();

  const userObj = user.toObject();
  delete userObj.password;

  return userObj;
};

/**
 * List all subscription plans
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Array>} List of plans
 */
const listPlans = async (filter = {}) => {
  await subscriptionPolicy.ensureFixedPlansExist();

  const { isActive } = filter;

  const query = {
    name: { $in: subscriptionPolicy.FIXED_PLAN_NAMES }
  };

  if (isActive !== undefined) {
    query.status = (isActive === true || isActive === 'true') ? 'ACTIVE' : 'INACTIVE';
  }

  const plans = await SubscriptionPlan.find(query).sort({ price: 1 });
  return subscriptionPolicy.dedupePlansByName(plans).map(subscriptionPolicy.attachPolicyToPlan);
};

module.exports = {
  createPlan,
  updatePlan,
  assignToDoctor,
  listPlans
};

