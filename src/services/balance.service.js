const User = require('../models/user.model');
const WithdrawalRequest = require('../models/withdrawalRequest.model');
const Transaction = require('../models/transaction.model');

/**
 * Get user balance
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User balance info
 */
const getUserBalance = async (userId) => {
  const user = await User.findById(userId).select('balance fullName email');
  
  if (!user) {
    throw new Error('User not found');
  }

  return {
    userId: user._id,
    balance: user.balance || 0,
    user: {
      fullName: user.fullName,
      email: user.email
    }
  };
};

/**
 * Top up user balance (Admin only)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to add
 * @param {string} adminId - Admin ID who is topping up
 * @returns {Promise<Object>} Updated balance
 */
const topUpBalance = async (userId, amount, adminId) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Update balance
  user.balance = (user.balance || 0) + amount;
  await user.save();

  // Create transaction record
  await Transaction.create({
    userId,
    amount,
    currency: 'USD',
    status: 'SUCCESS',
    provider: 'ADMIN_TOPUP',
    providerReference: `TOPUP-${Date.now()}-${userId}`,
    // Add metadata
    metadata: {
      type: 'TOPUP',
      adminId,
      timestamp: new Date()
    }
  });

  return {
    userId: user._id,
    balance: user.balance,
    topUpAmount: amount
  };
};

/**
 * Request withdrawal (Doctor/Patient)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to withdraw
 * @param {Object} paymentDetails - Payment method and details
 * @returns {Promise<Object>} Withdrawal request
 */
const requestWithdrawal = async (userId, amount, paymentDetails = {}) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Check if user has sufficient balance
  if ((user.balance || 0) < amount) {
    throw new Error('Insufficient balance');
  }

  // Check if there's a pending withdrawal request
  const pendingRequest = await WithdrawalRequest.findOne({
    userId,
    status: 'PENDING'
  });

  if (pendingRequest) {
    throw new Error('You already have a pending withdrawal request');
  }

  // Create withdrawal request
  const withdrawalRequest = await WithdrawalRequest.create({
    userId,
    amount,
    status: 'PENDING',
    paymentMethod: paymentDetails.paymentMethod || null,
    paymentDetails: paymentDetails.details || null
  });

  return withdrawalRequest;
};

/**
 * Approve withdrawal request (Admin only)
 * @param {string} requestId - Withdrawal request ID
 * @param {string} adminId - Admin ID
 * @returns {Promise<Object>} Approved request
 */
const approveWithdrawal = async (requestId, adminId) => {
  const request = await WithdrawalRequest.findById(requestId)
    .populate('userId', 'balance fullName email');
  
  if (!request) {
    throw new Error('Withdrawal request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error(`Cannot approve withdrawal request with status: ${request.status}`);
  }

  const user = request.userId;

  // Check if user still has sufficient balance
  if ((user.balance || 0) < request.amount) {
    request.status = 'REJECTED';
    request.rejectionReason = 'Insufficient balance at approval time';
    await request.save();
    throw new Error('User no longer has sufficient balance');
  }

  // Deduct balance
  user.balance = (user.balance || 0) - request.amount;
  await user.save();

  // Update request
  request.status = 'APPROVED';
  request.approvedAt = new Date();
  request.approvedBy = adminId;
  await request.save();

  // Create transaction record
  await Transaction.create({
    userId: user._id,
    amount: -request.amount, // Negative for withdrawal
    currency: 'USD',
    status: 'SUCCESS',
    provider: 'WITHDRAWAL',
    providerReference: `WITHDRAW-${Date.now()}-${user._id}`,
    metadata: {
      type: 'WITHDRAWAL',
      requestId: request._id,
      adminId,
      timestamp: new Date()
    }
  });

  return request;
};

/**
 * Reject withdrawal request (Admin only)
 * @param {string} requestId - Withdrawal request ID
 * @param {string} adminId - Admin ID
 * @param {string} reason - Rejection reason
 * @returns {Promise<Object>} Rejected request
 */
const rejectWithdrawal = async (requestId, adminId, reason = null) => {
  const request = await WithdrawalRequest.findById(requestId);
  
  if (!request) {
    throw new Error('Withdrawal request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error(`Cannot reject withdrawal request with status: ${request.status}`);
  }

  request.status = 'REJECTED';
  request.rejectionReason = reason || 'Rejected by admin';
  request.approvedBy = adminId;
  await request.save();

  return request;
};

/**
 * Get withdrawal requests
 * @param {Object} filter - Filter options
 * @returns {Promise<Object>} Withdrawal requests and pagination
 */
const getWithdrawalRequests = async (filter = {}) => {
  const {
    userId,
    status,
    page = 1,
    limit = 20
  } = filter;

  const query = {};

  if (userId) {
    query.userId = userId;
  }

  if (status) {
    query.status = status.toUpperCase();
  }

  const skip = (page - 1) * limit;

  const [requests, total] = await Promise.all([
    WithdrawalRequest.find(query)
      .populate('userId', 'fullName email balance')
      .populate('approvedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WithdrawalRequest.countDocuments(query)
  ]);

  return {
    requests,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  getUserBalance,
  topUpBalance,
  requestWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  getWithdrawalRequests
};

