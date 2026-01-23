const Transaction = require('../models/transaction.model');
const User = require('../models/user.model');

/**
 * Create transaction
 * @param {Object} data - Transaction data
 * @returns {Promise<Object>} Created transaction
 */
const createTransaction = async (data) => {
  const {
    userId,
    amount,
    currency,
    relatedAppointmentId,
    relatedSubscriptionId,
    relatedProductId,
    status,
    provider,
    providerReference
  } = data;

  // Verify user exists
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const transaction = await Transaction.create({
    userId,
    amount,
    currency: currency || 'EUR',
    relatedAppointmentId: relatedAppointmentId || null,
    relatedSubscriptionId: relatedSubscriptionId || null,
    relatedProductId: relatedProductId || null,
    status: status || 'PENDING',
    provider: provider || null,
    providerReference: providerReference || null
  });

  return transaction;
};

/**
 * Update transaction status
 * @param {string} id - Transaction ID
 * @param {string} status - New status
 * @returns {Promise<Object>} Updated transaction
 */
const updateTransactionStatus = async (id, status) => {
  const transaction = await Transaction.findById(id);
  
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  const validStatuses = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid transaction status');
  }

  transaction.status = status;
  await transaction.save();

  return transaction;
};

/**
 * List transactions with filtering
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Transactions and pagination info
 */
const listTransactions = async (filter = {}) => {
  const {
    userId,
    status,
    provider,
    type,
    fromDate,
    toDate,
    page = 1,
    limit = 10
  } = filter;

  const query = {};

  if (userId) {
    query.userId = userId;
  }

  if (status) {
    query.status = status.toUpperCase();
  }

  if (provider) {
    query.provider = provider;
  }

  // Filter by transaction type
  if (type) {
    const typeUpper = type.toUpperCase();
    if (typeUpper === 'APPOINTMENT') {
      query.relatedAppointmentId = { $ne: null };
    } else if (typeUpper === 'SUBSCRIPTION') {
      query.relatedSubscriptionId = { $ne: null };
    } else if (typeUpper === 'PRODUCT') {
      query.relatedProductId = { $ne: null };
    }
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      query.createdAt.$gte = new Date(fromDate);
    }
    if (toDate) {
      query.createdAt.$lte = new Date(toDate);
    }
  }

  const skip = (page - 1) * limit;

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate('userId', 'fullName email')
      .populate('relatedAppointmentId')
      .populate('relatedSubscriptionId')
      .populate('relatedProductId')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
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
 * @param {string} id - Transaction ID
 * @returns {Promise<Object>} Transaction
 */
const getTransaction = async (id) => {
  const transaction = await Transaction.findById(id)
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
  createTransaction,
  updateTransactionStatus,
  listTransactions,
  getTransaction
};

