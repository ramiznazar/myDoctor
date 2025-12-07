const SubscriptionPlan = require('../models/subscriptionPlan.model');

/**
 * Create subscription plan
 * @param {Object} data - Plan data
 * @returns {Promise<Object>} Created plan
 */
const createPlan = async (data) => {
  const { name, price, durationInDays, features } = data;

  // Check if plan with same name already exists
  const existingPlan = await SubscriptionPlan.findOne({ 
    name: { $regex: new RegExp(`^${name}$`, 'i') }
  });
  
  if (existingPlan) {
    throw new Error('Subscription plan with this name already exists');
  }

  const plan = await SubscriptionPlan.create({
    name,
    price,
    durationInDays,
    features: features || [],
    status: 'ACTIVE'
  });

  return plan;
};

/**
 * Get all subscription plans
 * @param {Object} filter - Filter options
 * @returns {Promise<Array>} List of subscription plans
 */
const getAllPlans = async (filter = {}) => {
  const query = {};
  
  if (filter.status) {
    query.status = filter.status.toUpperCase();
  }

  const plans = await SubscriptionPlan.find(query).sort({ createdAt: -1 });
  return plans;
};

/**
 * Get all active subscription plans (for doctors to view available plans)
 * @returns {Promise<Array>} List of active subscription plans
 */
const getActivePlans = async () => {
  const plans = await SubscriptionPlan.find({ status: 'ACTIVE' })
    .sort({ price: 1 });
  return plans;
};

/**
 * Get subscription plan by ID
 * @param {string} id - Plan ID
 * @returns {Promise<Object>} Subscription plan
 */
const getPlanById = async (id) => {
  const plan = await SubscriptionPlan.findById(id);
  
  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  return plan;
};

/**
 * Update subscription plan
 * @param {string} id - Plan ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated subscription plan
 */
const updatePlan = async (id, data) => {
  const plan = await SubscriptionPlan.findById(id);
  
  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  const { name, price, durationInDays, features, status } = data;

  if (name) {
    // Check if another plan with same name exists
    const existingPlan = await SubscriptionPlan.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      _id: { $ne: id }
    });
    if (existingPlan) {
      throw new Error('Subscription plan with this name already exists');
    }
    plan.name = name;
  }

  if (price !== undefined) {
    plan.price = price;
  }

  if (durationInDays !== undefined) {
    plan.durationInDays = durationInDays;
  }

  if (features !== undefined) {
    plan.features = features;
  }

  if (status) {
    plan.status = status.toUpperCase();
  }

  await plan.save();

  return plan;
};

/**
 * Delete subscription plan
 * @param {string} id - Plan ID
 * @returns {Promise<Object>} Success message
 */
const deletePlan = async (id) => {
  const plan = await SubscriptionPlan.findById(id);
  
  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  await SubscriptionPlan.findByIdAndDelete(id);

  return { message: 'Subscription plan deleted successfully' };
};

module.exports = {
  createPlan,
  getAllPlans,
  getActivePlans,
  getPlanById,
  updatePlan,
  deletePlan
};








