const asyncHandler = require('../middleware/asyncHandler');
const balanceService = require('../services/balance.service');

/**
 * Get user balance
 */
exports.getBalance = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const result = await balanceService.getUserBalance(userId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Top up user balance (Admin only)
 */
exports.topUp = asyncHandler(async (req, res) => {
  const { userId, amount } = req.body;
  const adminId = req.userId;
  const result = await balanceService.topUpBalance(userId, amount, adminId);
  res.json({ success: true, message: 'Balance topped up successfully', data: result });
});

/**
 * Request withdrawal
 */
exports.requestWithdrawal = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { amount, paymentMethod, paymentDetails } = req.body;
  const result = await balanceService.requestWithdrawal(userId, amount, {
    paymentMethod,
    details: paymentDetails
  });
  res.json({ success: true, message: 'Withdrawal request submitted successfully', data: result });
});

/**
 * Approve withdrawal request (Admin only)
 */
exports.approveWithdrawal = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const adminId = req.userId;
  const result = await balanceService.approveWithdrawal(requestId, adminId);
  res.json({ success: true, message: 'Withdrawal request approved', data: result });
});

/**
 * Reject withdrawal request (Admin only)
 */
exports.rejectWithdrawal = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { reason } = req.body;
  const adminId = req.userId;
  const result = await balanceService.rejectWithdrawal(requestId, adminId, reason);
  res.json({ success: true, message: 'Withdrawal request rejected', data: result });
});

/**
 * Get withdrawal requests
 */
exports.getWithdrawalRequests = asyncHandler(async (req, res) => {
  const filter = { ...req.query };
  
  // If not admin, only show their own requests
  if (req.userRole !== 'ADMIN') {
    filter.userId = req.userId;
  }
  
  const result = await balanceService.getWithdrawalRequests(filter);
  res.json({ success: true, message: 'OK', data: result });
});

