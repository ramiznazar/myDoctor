const SubscriptionPlan = require('../models/subscriptionPlan.model');
const User = require('../models/user.model');

/**
 * Create subscription plan
 * @param {Object} data - Plan data
 * @returns {Promise<Object>} Created plan
 */
const createPlan = async (data) => {
  const { name, price, durationInDays, features, isActive } = data;

  const plan = await SubscriptionPlan.create({
    name: name.toUpperCase(),
    price,
    durationInDays,
    features: features || [],
    isActive: isActive !== undefined ? isActive : true
  });

  return plan;
};

/**
 * Update subscription plan
 * @param {string} id - Plan ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated plan
 */
const updatePlan = async (id, data) => {
  const plan = await SubscriptionPlan.findById(id);
  
  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      if (key === 'name') {
        plan[key] = data[key].toUpperCase();
      } else {
        plan[key] = data[key];
      }
    }
  });

  await plan.save();

  return plan;
};

/**
 * Assign subscription plan to doctor
 * @param {string} doctorId - Doctor user ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Updated user
 */
const assignToDoctor = async (doctorId, planId) => {
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

  if (!plan.isActive) {
    throw new Error('Subscription plan is not active');
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
  const { isActive } = filter;
  
  const query = {};
  if (isActive !== undefined) {
    query.isActive = isActive === true || isActive === 'true';
  }

  const plans = await SubscriptionPlan.find(query).sort({ price: 1 });
  return plans;
};

module.exports = {
  createPlan,
  updatePlan,
  assignToDoctor,
  listPlans
};

