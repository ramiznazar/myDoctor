const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/payment/appointment
 * @desc    Process appointment payment
 * @access  Private
 */
router.post(
  '/appointment',
  authGuard([]),
  asyncHandler(paymentController.processAppointmentPayment)
);

/**
 * @route   POST /api/payment/subscription
 * @desc    Process subscription payment
 * @access  Private (Doctor)
 */
router.post(
  '/subscription',
  authGuard(['DOCTOR']),
  asyncHandler(paymentController.processSubscriptionPayment)
);

/**
 * @route   POST /api/payment/product
 * @desc    Process product payment (single product - legacy)
 * @access  Private
 */
router.post(
  '/product',
  authGuard([]),
  asyncHandler(paymentController.processProductPayment)
);

/**
 * @route   POST /api/payment/order
 * @desc    Process order payment
 * @access  Private
 */
router.post(
  '/order',
  authGuard([]),
  asyncHandler(paymentController.processOrderPayment)
);

/**
 * @route   GET /api/payment/transactions
 * @desc    Get user transactions
 * @access  Private
 */
router.get(
  '/transactions',
  authGuard([]),
  asyncHandler(paymentController.getUserTransactions)
);

/**
 * @route   GET /api/payment/transaction/:id
 * @desc    Get transaction by ID
 * @access  Private
 */
router.get(
  '/transaction/:id',
  authGuard([]),
  asyncHandler(paymentController.getTransactionById)
);

/**
 * @route   POST /api/payment/refund/:id
 * @desc    Refund transaction (admin only)
 * @access  Private (Admin)
 */
router.post(
  '/refund/:id',
  authGuard(['ADMIN']),
  asyncHandler(paymentController.refundTransaction)
);

module.exports = router;














