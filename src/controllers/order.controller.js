const asyncHandler = require('../middleware/asyncHandler');
const orderService = require('../services/order.service');

/**
 * Create order
 */
exports.create = asyncHandler(async (req, res) => {
  const { items, shippingAddress, paymentMethod } = req.body;
  const result = await orderService.createOrder(
    req.userId,
    items,
    shippingAddress,
    paymentMethod
  );
  res.json({ success: true, message: 'Order created successfully', data: result });
});

/**
 * Get order by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await orderService.getOrderById(
    req.params.id,
    req.userId,
    req.userRole
  );
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get patient orders
 */
exports.getPatientOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getPatientOrders(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get pharmacy orders (for pharmacy owner/doctor)
 */
exports.getPharmacyOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getPharmacyOrders(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get all orders (admin only)
 */
exports.getAllOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getAllOrders(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update order status
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const result = await orderService.updateOrderStatus(
    req.params.id,
    status,
    req.userId,
    req.userRole
  );
  res.json({ success: true, message: 'Order status updated successfully', data: result });
});

/**
 * Update shipping fee
 * @deprecated Shipping fee is now set during checkout
 */
exports.updateShippingFee = asyncHandler(async (req, res) => {
  res.status(400).json({ 
    success: false, 
    message: 'Shipping fee cannot be updated. Payment is processed during checkout with the final shipping fee.' 
  });
});

/**
 * Pay for order
 */
exports.payForOrder = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body;
  const result = await orderService.payForOrder(
    req.params.id,
    paymentMethod || 'DUMMY'
  );
  res.json({ success: true, message: 'Payment processed successfully', data: result });
});

/**
 * Cancel order
 */
exports.cancel = asyncHandler(async (req, res) => {
  const result = await orderService.cancelOrder(
    req.params.id,
    req.userId,
    req.userRole
  );
  res.json({ success: true, message: 'Order cancelled successfully', data: result });
});

