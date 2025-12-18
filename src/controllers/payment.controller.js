const asyncHandler = require('../middleware/asyncHandler');
const paymentService = require('../services/payment.service');

/**
 * Process appointment payment
 */
exports.processAppointmentPayment = asyncHandler(async (req, res) => {
  const { appointmentId, amount, paymentMethod } = req.body;
  const result = await paymentService.processAppointmentPayment(
    req.userId,
    appointmentId,
    amount,
    paymentMethod || 'DUMMY'
  );
  res.json({ success: true, message: 'Payment processed successfully', data: result });
});

/**
 * Process subscription payment
 */
exports.processSubscriptionPayment = asyncHandler(async (req, res) => {
  const { subscriptionPlanId, amount, paymentMethod } = req.body;
  const result = await paymentService.processSubscriptionPayment(
    req.userId,
    subscriptionPlanId,
    amount,
    paymentMethod || 'DUMMY'
  );
  res.json({ success: true, message: 'Subscription payment processed successfully', data: result });
});

/**
 * Process product payment
 */
exports.processProductPayment = asyncHandler(async (req, res) => {
  const { productId, amount, paymentMethod } = req.body;
  const result = await paymentService.processProductPayment(
    req.userId,
    productId,
    amount,
    paymentMethod || 'DUMMY'
  );
  res.json({ success: true, message: 'Product payment processed successfully', data: result });
});

/**
 * Get user transactions
 */
exports.getUserTransactions = asyncHandler(async (req, res) => {
  const result = await paymentService.getUserTransactions(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get transaction by ID
 */
exports.getTransactionById = asyncHandler(async (req, res) => {
  const result = await paymentService.getTransactionById(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Refund transaction (admin only)
 */
exports.refundTransaction = asyncHandler(async (req, res) => {
  const result = await paymentService.refundTransaction(req.params.id);
  res.json({ success: true, message: 'Transaction refunded successfully', data: result });
});












