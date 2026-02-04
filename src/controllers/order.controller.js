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
  if (req.userRole === 'PHARMACY' || req.userRole === 'PARAPHARMACY') {
    const status = req.user?.status?.toUpperCase();
    if (status !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Your pharmacy account is not approved yet. You cannot manage orders until approved.'
      });
    }

    if (req.userRole === 'PHARMACY') {
      const subscriptionPolicy = require('../services/subscriptionPolicy.service');
      await subscriptionPolicy.enforcePharmacySubscriptionActive({ pharmacyUserId: req.userId });
    }
  }
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
  if (req.userRole === 'PHARMACY' || req.userRole === 'PARAPHARMACY') {
    const status = req.user?.status?.toUpperCase();
    if (status !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Your pharmacy account is not approved yet. You cannot update order status until approved.'
      });
    }

    if (req.userRole === 'PHARMACY') {
      const subscriptionPolicy = require('../services/subscriptionPolicy.service');
      await subscriptionPolicy.enforcePharmacySubscriptionActive({ pharmacyUserId: req.userId });
    }
  }
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
 * Only pharmacy owner (doctor) can update shipping fee
 */
exports.updateShippingFee = asyncHandler(async (req, res) => {
  if (req.userRole === 'PHARMACY' || req.userRole === 'PARAPHARMACY') {
    const status = req.user?.status?.toUpperCase();
    if (status !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Your pharmacy account is not approved yet. You cannot update shipping until approved.'
      });
    }

    if (req.userRole === 'PHARMACY') {
      const subscriptionPolicy = require('../services/subscriptionPolicy.service');
      await subscriptionPolicy.enforcePharmacySubscriptionActive({ pharmacyUserId: req.userId });
    }
  }
  const { shippingFee } = req.body;
  const result = await orderService.updateShippingFee(
    req.params.id,
    shippingFee,
    req.userId,
    req.userRole
  );
  res.json({ 
    success: true, 
    message: 'Shipping fee updated successfully. Patient can now pay for the order.', 
    data: result 
  });
});

/**
 * Pay for order
 * Patient pays for order after doctor has set the shipping fee
 */
exports.payForOrder = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body;
  const result = await orderService.payForOrder(
    req.params.id,
    req.userId,
    req.userRole,
    paymentMethod || 'DUMMY'
  );
  res.json({ 
    success: true, 
    message: 'Payment processed successfully', 
    data: result 
  });
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

