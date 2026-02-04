const SubscriptionPlan = require('../models/subscriptionPlan.model');
const subscriptionPolicy = require('./subscriptionPolicy.service');

const normalizeTargetRole = (targetRole) => {
  const role = String(targetRole || subscriptionPolicy.TARGET_ROLES.DOCTOR).toUpperCase();
  return role === subscriptionPolicy.TARGET_ROLES.PHARMACY
    ? subscriptionPolicy.TARGET_ROLES.PHARMACY
    : subscriptionPolicy.TARGET_ROLES.DOCTOR;
};

const buildRoleQuery = (role) => {
  if (role === subscriptionPolicy.TARGET_ROLES.PHARMACY) {
    return { targetRole: subscriptionPolicy.TARGET_ROLES.PHARMACY };
  }

  return {
    $or: [
      { targetRole: subscriptionPolicy.TARGET_ROLES.DOCTOR },
      { targetRole: { $exists: false } },
      { targetRole: null }
    ]
  };
};

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
  const role = normalizeTargetRole(filter.targetRole);
  await subscriptionPolicy.ensureFixedPlansExist(role);

  const query = {
    ...buildRoleQuery(role),
    name: { $in: subscriptionPolicy.getFixedPlanNames(role) }
  };

  if (filter.status) {
    query.status = filter.status.toUpperCase();
  }

  const plans = await SubscriptionPlan.find(query).sort({ price: 1 });
  return plans.map((p) => subscriptionPolicy.attachPolicyToPlan(p, role));
};

/**
 * Get all active subscription plans (for doctors to view available plans)
 * @returns {Promise<Array>} List of active subscription plans
 */
const getActivePlans = async () => {
  const role = normalizeTargetRole();
  await subscriptionPolicy.ensureFixedPlansExist(role);

  const plans = await SubscriptionPlan.find({
    ...buildRoleQuery(role),
    name: { $in: subscriptionPolicy.getFixedPlanNames(role) },
    status: 'ACTIVE'
  }).sort({ price: 1 });

  return plans.map((p) => subscriptionPolicy.attachPolicyToPlan(p, role));
};

const getActivePlansByRole = async (targetRole) => {
  const role = normalizeTargetRole(targetRole);
  await subscriptionPolicy.ensureFixedPlansExist(role);

  const plans = await SubscriptionPlan.find({
    ...buildRoleQuery(role),
    name: { $in: subscriptionPolicy.getFixedPlanNames(role) },
    status: 'ACTIVE'
  }).sort({ price: 1 });

  return plans.map((p) => subscriptionPolicy.attachPolicyToPlan(p, role));
};

/**
 * Get subscription plan by ID
 * @param {string} id - Plan ID
 * @returns {Promise<Object>} Subscription plan
 */
const getPlanById = async (id) => {
  await Promise.all([
    subscriptionPolicy.ensureFixedPlansExist(subscriptionPolicy.TARGET_ROLES.DOCTOR),
    subscriptionPolicy.ensureFixedPlansExist(subscriptionPolicy.TARGET_ROLES.PHARMACY)
  ]);

  const plan = await SubscriptionPlan.findById(id);
 
  if (!plan) {
    const error = new Error('Subscription plan not found');
    error.statusCode = 404;
    throw error;
  }

  const role = normalizeTargetRole(plan.targetRole);
  const normalizedName = subscriptionPolicy.normalizePlanName(plan.name, role);
  const fixedNames = subscriptionPolicy.getFixedPlanNames(role);
  if (!fixedNames.includes(normalizedName)) {
    const error = new Error('Subscription plan not found');
    error.statusCode = 404;
    throw error;
  }

  return subscriptionPolicy.attachPolicyToPlan(plan, role);
};

/**
 * Update subscription plan
 * @param {string} id - Plan ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated subscription plan
 */
const updatePlan = async (id, data) => {
  await Promise.all([
    subscriptionPolicy.ensureFixedPlansExist(subscriptionPolicy.TARGET_ROLES.DOCTOR),
    subscriptionPolicy.ensureFixedPlansExist(subscriptionPolicy.TARGET_ROLES.PHARMACY)
  ]);

  const plan = await SubscriptionPlan.findById(id);
 
  if (!plan) {
    const error = new Error('Subscription plan not found');
    error.statusCode = 404;
    throw error;
  }

  const role = normalizeTargetRole(plan.targetRole);
  const normalizedName = subscriptionPolicy.normalizePlanName(plan.name, role);
  const fixedNames = subscriptionPolicy.getFixedPlanNames(role);
  if (!fixedNames.includes(normalizedName)) {
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

  return subscriptionPolicy.attachPolicyToPlan(plan, role);
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
  getActivePlansByRole,
  getPlanById,
  updatePlan,
  deletePlan
};


