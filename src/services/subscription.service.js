const SubscriptionPlan = require('../models/subscriptionPlan.model');
const User = require('../models/user.model');
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
 * Assign subscription plan to doctor
 * @param {string} doctorId - Doctor user ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Updated user
 */
const assignToDoctor = async (doctorId, planId) => {
  await subscriptionPolicy.ensureFixedPlansExist(subscriptionPolicy.TARGET_ROLES.DOCTOR);

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

  const role = subscriptionPolicy.TARGET_ROLES.DOCTOR;
  const normalizedName = subscriptionPolicy.normalizePlanName(plan.name, role);
  const fixedNames = subscriptionPolicy.getFixedPlanNames(role);
  if (!fixedNames.includes(normalizedName)) {
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
  const role = normalizeTargetRole(filter.targetRole);
  await subscriptionPolicy.ensureFixedPlansExist(role);

  const { isActive } = filter;

  const query = {
    ...buildRoleQuery(role),
    name: { $in: subscriptionPolicy.getFixedPlanNames(role) }
  };

  if (isActive !== undefined) {
    query.status = (isActive === true || isActive === 'true') ? 'ACTIVE' : 'INACTIVE';
  }

  const plans = await SubscriptionPlan.find(query).sort({ price: 1 });
  return plans.map((p) => subscriptionPolicy.attachPolicyToPlan(p, role));
};

module.exports = {
  createPlan,
  updatePlan,
  assignToDoctor,
  listPlans
};

