const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const {
  createTransactionValidator,
  updateTransactionStatusValidator,
  filterTransactionsValidator
} = require('../validators/transaction.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/transaction
 * @desc    Create transaction
 * @access  Private
 */
router.post(
  '/',
  authGuard([]),
  validate(createTransactionValidator),
  asyncHandler(transactionController.create)
);

/**
 * @route   PUT /api/transaction/:id
 * @desc    Update transaction status
 * @access  Private (Admin)
 */
router.put(
  '/:id',
  authGuard(['ADMIN']),
  validate(updateTransactionStatusValidator),
  asyncHandler(transactionController.updateStatus)
);

/**
 * @route   GET /api/transaction
 * @desc    List transactions with filtering
 * @access  Private (Admin)
 */
router.get(
  '/',
  authGuard(['ADMIN']),
  validate(filterTransactionsValidator),
  asyncHandler(transactionController.list)
);

/**
 * @route   GET /api/transaction/:id
 * @desc    Get transaction by ID
 * @access  Private
 */
router.get(
  '/:id',
  authGuard([]),
  asyncHandler(transactionController.getById)
);

module.exports = router;

