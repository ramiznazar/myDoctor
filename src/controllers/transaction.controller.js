const asyncHandler = require('../middleware/asyncHandler');
const transactionService = require('../services/transaction.service');

/**
 * Create transaction
 */
exports.create = asyncHandler(async (req, res) => {
  const transactionData = {
    ...req.body,
    userId: req.body.userId || req.userId
  };
  const result = await transactionService.createTransaction(transactionData);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update transaction status
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const result = await transactionService.updateTransactionStatus(req.params.id, req.body.status);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get transaction by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await transactionService.getTransaction(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List transactions with filtering
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await transactionService.listTransactions(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

