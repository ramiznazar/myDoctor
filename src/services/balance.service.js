const User = require('../models/user.model');
const WithdrawalRequest = require('../models/withdrawalRequest.model');
const Transaction = require('../models/transaction.model');

/**
 * Calculate net amount after platform fee
 * @param {number} amount - Gross amount
 * @param {number} platformFeePercent - Platform fee percentage (0-100)
 * @returns {Object} { netAmount, platformFee }
 */
const calculateNetAmount = (amount, platformFeePercent = 0) => {
  const platformFee = (amount * platformFeePercent) / 100;
  const netAmount = amount - platformFee;
  return { netAmount, platformFee };
};

/**
 * Credit balance to user (internal helper)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to credit
 * @param {string} transactionType - Type of transaction (APPOINTMENT, ORDER, etc.)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Updated balance info
 */
const creditBalance = async (userId, amount, transactionType, metadata = {}) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Get platform fee percentage from env (default 0%)
  const platformFeePercent = parseFloat(process.env.PLATFORM_FEE_PERCENT || '0');
  const { netAmount, platformFee } = calculateNetAmount(amount, platformFeePercent);

  // Update balance
  user.balance = (user.balance || 0) + netAmount;
  await user.save();

  // Create transaction record for the credit
  await Transaction.create({
    userId,
    amount: netAmount,
    currency: 'EUR',
    status: 'SUCCESS',
    provider: 'BALANCE_CREDIT',
    providerReference: `${transactionType}-${Date.now()}-${userId}`,
    metadata: {
      type: 'BALANCE_CREDIT',
      transactionType,
      grossAmount: amount,
      platformFee,
      platformFeePercent,
      netAmount,
      ...metadata
    }
  });

  return {
    userId: user._id,
    balance: user.balance,
    creditedAmount: netAmount,
    platformFee,
    grossAmount: amount
  };
};

/**
 * Debit balance from user (for refunds)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to debit
 * @param {string} transactionType - Type of transaction (REFUND, etc.)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Updated balance info
 */
const debitBalance = async (userId, amount, transactionType, metadata = {}) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const user = await User.findById(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Check if user has sufficient balance
  const currentBalance = user.balance || 0;
  if (currentBalance < amount) {
    // Allow negative balance for refunds (doctor owes the platform)
    // But log a warning
    console.warn(`Warning: Debiting ${amount} from user ${userId} with balance ${currentBalance} (will result in negative balance)`);
  }

  // Update balance
  user.balance = currentBalance - amount;
  await user.save();

  // Create transaction record for the debit
  await Transaction.create({
    userId,
    amount: -amount, // Negative for debit
    currency: 'EUR',
    status: 'SUCCESS',
    provider: 'BALANCE_DEBIT',
    providerReference: `${transactionType}-${Date.now()}-${userId}`,
    metadata: {
      type: 'BALANCE_DEBIT',
      transactionType,
      amount,
      ...metadata
    }
  });

  return {
    userId: user._id,
    balance: user.balance,
    debitedAmount: amount
  };
};

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
    currency: 'EUR',
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
 * @param {number} withdrawalFeePercent - Withdrawal fee percentage (0-100)
 * @returns {Promise<Object>} Approved request
 */
const approveWithdrawal = async (requestId, adminId, withdrawalFeePercent = null) => {
  const request = await WithdrawalRequest.findById(requestId)
    .populate('userId', 'balance fullName email');
  
  if (!request) {
    throw new Error('Withdrawal request not found');
  }

  if (request.status !== 'PENDING') {
    throw new Error(`Cannot approve withdrawal request with status: ${request.status}`);
  }

  const user = request.userId;
  const withdrawalAmount = request.amount;

  // Validate fee percentage if provided
  if (withdrawalFeePercent !== null) {
    if (withdrawalFeePercent < 0 || withdrawalFeePercent > 100) {
      throw new Error('Withdrawal fee percentage must be between 0 and 100');
    }
  }

  // Calculate fee and totals
  // Fee is deducted FROM the withdrawal amount, not added to it
  const feePercent = withdrawalFeePercent !== null ? withdrawalFeePercent : 0;
  const withdrawalFeeAmount = (withdrawalAmount * feePercent) / 100;
  const netAmount = withdrawalAmount - withdrawalFeeAmount; // Doctor receives withdrawal amount minus fee
  const totalDeducted = withdrawalAmount; // Total deducted from balance is the original withdrawal amount (fee is included)

  // Check if user has sufficient balance (must cover the withdrawal amount)
  if ((user.balance || 0) < totalDeducted) {
    request.status = 'REJECTED';
    request.rejectionReason = `Insufficient balance. Required: ${totalDeducted.toFixed(2)}, Available: ${(user.balance || 0).toFixed(2)}`;
    await request.save();
    throw new Error(`Insufficient balance. Required: $${totalDeducted.toFixed(2)}, Available: $${(user.balance || 0).toFixed(2)}`);
  }

  // Deduct withdrawal amount from balance (fee is already included in the withdrawal amount)
  user.balance = (user.balance || 0) - totalDeducted;
  await user.save();

  // Update request with fee information
  request.status = 'APPROVED';
  request.approvedAt = new Date();
  request.approvedBy = adminId;
  request.withdrawalFeePercent = feePercent;
  request.withdrawalFeeAmount = withdrawalFeeAmount;
  request.totalDeducted = totalDeducted;
  request.netAmount = netAmount;
  await request.save();

  // Create transaction record for the withdrawal
  await Transaction.create({
    userId: user._id,
    amount: -totalDeducted, // Negative for withdrawal (amount deducted from balance)
    currency: 'EUR',
    status: 'SUCCESS',
    provider: 'WITHDRAWAL',
    providerReference: `WITHDRAW-${Date.now()}-${user._id}`,
    metadata: {
      type: 'WITHDRAWAL',
      requestId: request._id,
      adminId,
      withdrawalAmount: withdrawalAmount, // Original requested amount
      withdrawalFeePercent: feePercent,
      withdrawalFeeAmount: withdrawalFeeAmount, // Fee deducted from withdrawal
      totalDeducted: totalDeducted, // Amount deducted from balance (same as withdrawalAmount)
      netAmount: netAmount, // Amount doctor actually receives (withdrawalAmount - fee)
      timestamp: new Date()
    }
  });

  // Note: Fee is already included in the withdrawal amount, so no separate fee transaction needed
  // The fee is just a portion of the withdrawal that the doctor doesn't receive

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
  getWithdrawalRequests,
  creditBalance,
  debitBalance,
  calculateNetAmount
};

