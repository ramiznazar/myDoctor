const Transaction = require('../models/transaction.model');
const Appointment = require('../models/appointment.model');
const User = require('../models/user.model');
const SubscriptionPlan = require('../models/subscriptionPlan.model');
const Product = require('../models/product.model');
const DoctorSubscription = require('../models/doctorSubscription.model');

/**
 * Process appointment payment
 * @param {string} userId - User ID (patient)
 * @param {string} appointmentId - Appointment ID
 * @param {number} amount - Payment amount
 * @param {string} paymentMethod - Payment method
 * @returns {Promise<Object>} Transaction
 */
const processAppointmentPayment = async (userId, appointmentId, amount, paymentMethod = 'DUMMY') => {
  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  // Create transaction
  const transaction = await Transaction.create({
    userId,
    amount,
    currency: 'USD',
    relatedAppointmentId: appointmentId,
    status: 'SUCCESS',
    provider: paymentMethod,
    providerReference: `APT-${Date.now()}`
  });

  // Update appointment payment status
  appointment.paymentStatus = 'PAID';
  appointment.paymentMethod = paymentMethod;
  await appointment.save();

  return transaction;
};

/**
 * Process subscription payment
 * @param {string} doctorId - Doctor user ID
 * @param {string} planId - Subscription plan ID
 * @param {number} amount - Payment amount
 * @param {string} paymentMethod - Payment method
 * @returns {Promise<Object>} Transaction and subscription
 */
const processSubscriptionPayment = async (doctorId, planId, amount, paymentMethod = 'DUMMY') => {
  const doctor = await User.findById(doctorId);
  const plan = await SubscriptionPlan.findById(planId);
  
  if (!doctor || doctor.role !== 'DOCTOR') {
    throw new Error('Doctor not found');
  }

  if (!plan) {
    throw new Error('Subscription plan not found');
  }

  // Create transaction
  const transaction = await Transaction.create({
    userId: doctorId,
    amount,
    currency: 'USD',
    relatedSubscriptionId: planId,
    status: 'SUCCESS',
    provider: paymentMethod,
    providerReference: `SUB-${Date.now()}`
  });

  // Calculate expiration date
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationInDays);

  // Create or update subscription
  const subscription = await DoctorSubscription.findOneAndUpdate(
    { doctorId, status: 'ACTIVE' },
    {
      doctorId,
      planId,
      startDate,
      endDate,
      status: 'ACTIVE',
      transactionId: transaction._id
    },
    { upsert: true, new: true }
  );

  // Update user subscription
  doctor.subscriptionPlan = planId;
  doctor.subscriptionExpiresAt = endDate;
  await doctor.save();

  return { transaction, subscription };
};

/**
 * Process product payment (single product - legacy)
 * @param {string} userId - User ID (patient)
 * @param {string} productId - Product ID
 * @param {number} amount - Payment amount
 * @param {string} paymentMethod - Payment method
 * @returns {Promise<Object>} Transaction
 */
const processProductPayment = async (userId, productId, amount, paymentMethod = 'DUMMY') => {
  const product = await Product.findById(productId);
  
  if (!product) {
    throw new Error('Product not found');
  }

  // Create transaction
  const transaction = await Transaction.create({
    userId,
    amount,
    currency: 'USD',
    relatedProductId: productId,
    status: 'SUCCESS',
    provider: paymentMethod,
    providerReference: `PROD-${Date.now()}`
  });

  // Update product stock if needed
  if (product.stock > 0) {
    product.stock -= 1;
    await product.save();
  }

  return transaction;
};

/**
 * Process order payment
 * @param {string} orderId - Order ID
 * @param {string} paymentMethod - Payment method
 * @param {number} amount - Optional amount to pay (if not provided, uses order.total)
 * @returns {Promise<Object>} Transaction and updated order
 */
const processOrderPayment = async (orderId, paymentMethod = 'DUMMY', amount = null) => {
  const Order = require('../models/order.model');
  const orderService = require('./order.service');
  
  const order = await Order.findById(orderId)
    .populate('items.productId');

  if (!order) {
    throw new Error('Order not found');
  }

  // Cannot pay if shipping fee is not set yet
  if (order.finalShipping === null || order.finalShipping === undefined) {
    throw new Error('Cannot pay for order: Shipping fee has not been set by the pharmacy owner yet');
  }

  // Calculate amount to pay
  let amountToPay = amount !== null ? amount : order.total;
  
  // If order was partially paid, calculate difference
  if (order.paymentStatus === 'PARTIAL' && order.requiresPaymentUpdate) {
    const alreadyPaid = order.initialTotal || 0;
    amountToPay = order.total - alreadyPaid;
  } else if (order.paymentStatus === 'PAID' && !order.requiresPaymentUpdate) {
    throw new Error('Order already paid');
  }

  if (amountToPay <= 0) {
    throw new Error('No payment required');
  }

  // Create transaction
  const transaction = await Transaction.create({
    userId: order.patientId,
    amount: amountToPay,
    currency: 'USD',
    relatedProductId: order.items[0]?.productId?._id || null, // For backward compatibility
    relatedOrderId: order._id, // Link to order
    status: 'SUCCESS',
    provider: paymentMethod,
    providerReference: `ORD-${order.orderNumber}`
  });

  // Link transaction to order
  await orderService.linkTransactionToOrder(orderId, transaction._id);

  // Update order payment status
  if (order.paymentStatus === 'PARTIAL') {
    order.paymentStatus = 'PAID';
    order.requiresPaymentUpdate = false;
  } else {
    order.paymentStatus = 'PAID';
  }
  order.paymentMethod = paymentMethod;
  await order.save();

  return { transaction, order };
};

/**
 * Refund transaction
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object>} Refunded transaction
 */
const refundTransaction = async (transactionId) => {
  const transaction = await Transaction.findById(transactionId);
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  if (transaction.status === 'REFUNDED') {
    throw new Error('Transaction already refunded');
  }

  transaction.status = 'REFUNDED';
  await transaction.save();

  // Update related appointment if exists
  if (transaction.relatedAppointmentId) {
    const appointment = await Appointment.findById(transaction.relatedAppointmentId);
    if (appointment) {
      appointment.paymentStatus = 'REFUNDED';
      await appointment.save();
    }
  }

  return transaction;
};

/**
 * Get user transactions
 * @param {string} userId - User ID
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Transactions and pagination
 */
const getUserTransactions = async (userId, options = {}) => {
  const { status, page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const query = { userId };
  if (status) {
    query.status = status.toUpperCase();
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate('relatedAppointmentId')
      .populate('relatedSubscriptionId')
      .populate('relatedProductId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments(query)
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get transaction by ID
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object>} Transaction
 */
const getTransactionById = async (transactionId) => {
  const transaction = await Transaction.findById(transactionId)
    .populate('userId', 'fullName email')
    .populate('relatedAppointmentId')
    .populate('relatedSubscriptionId')
    .populate('relatedProductId');
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  return transaction;
};

module.exports = {
  processAppointmentPayment,
  processSubscriptionPayment,
  processProductPayment,
  processOrderPayment,
  refundTransaction,
  getUserTransactions,
  getTransactionById
};














