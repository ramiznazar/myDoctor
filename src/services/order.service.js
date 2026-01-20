const Order = require('../models/order.model');
const Product = require('../models/product.model');
const Pharmacy = require('../models/pharmacy.model');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');

/**
 * Create order from cart items
 * @param {string} patientId - Patient user ID
 * @param {Array} items - Order items [{ productId, quantity }]
 * @param {Object} shippingAddress - Shipping address
 * @param {string} paymentMethod - Payment method
 * @returns {Promise<Object>} Created order
 */
const createOrder = async (patientId, items, shippingAddress, paymentMethod = null) => {
  if (!items || items.length === 0) {
    throw new Error('Order items are required');
  }

  // Verify patient exists
  const patient = await User.findById(patientId);
  if (!patient || patient.role !== 'PATIENT') {
    throw new Error('Patient not found');
  }

  // Get all products and calculate totals
  const productIds = items.map(item => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });

  if (products.length !== productIds.length) {
    throw new Error('One or more products not found');
  }

  // Group products by pharmacy/owner
  const pharmacyMap = new Map();
  let orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = products.find(p => p._id.toString() === item.productId.toString());
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    // Check stock
    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`);
    }

    // Get pharmacy for this product
    const pharmacy = await Pharmacy.findOne({ ownerId: product.sellerId });
    if (!pharmacy) {
      throw new Error(`Pharmacy not found for product ${product.name}`);
    }

    const pharmacyId = pharmacy._id.toString();
    if (!pharmacyMap.has(pharmacyId)) {
      pharmacyMap.set(pharmacyId, {
        pharmacyId: pharmacy._id,
        ownerId: pharmacy.ownerId,
        items: []
      });
    }

    const itemPrice = product.discountPrice || product.price;
    const itemTotal = itemPrice * item.quantity;
    subtotal += itemTotal;

    orderItems.push({
      productId: product._id,
      quantity: item.quantity,
      price: product.price,
      discountPrice: product.discountPrice,
      total: itemTotal
    });

    pharmacyMap.get(pharmacyId).items.push({
      productId: product._id,
      quantity: item.quantity,
      price: product.price,
      discountPrice: product.discountPrice,
      total: itemTotal
    });
  }

  // For now, we'll create one order per pharmacy
  // In a real scenario, you might want to create multiple orders if items are from different pharmacies
  // For simplicity, we'll assume all items are from the same pharmacy
  if (pharmacyMap.size > 1) {
    throw new Error('All items must be from the same pharmacy');
  }

  const pharmacyData = Array.from(pharmacyMap.values())[0];
  const tax = subtotal * 0.1; // 10% tax (you can make this configurable)
  const shipping = shippingAddress ? 10 : 0; // Fixed shipping fee (you can make this configurable)
  const total = subtotal + tax + shipping;

  // Create order first (orderNumber will be auto-generated in pre-save hook)
  const order = await Order.create({
    patientId,
    pharmacyId: pharmacyData.pharmacyId,
    ownerId: pharmacyData.ownerId,
    items: orderItems,
    subtotal,
    tax,
    shipping: shipping, // Final shipping fee
    total: total, // Final total
    shippingAddress: shippingAddress || {},
    paymentMethod: paymentMethod || 'DUMMY',
    status: 'CONFIRMED', // Order is confirmed since payment is done
    paymentStatus: 'PENDING' // Will be updated to PAID after transaction
  });

  // Process payment immediately after order creation
  const Transaction = require('../models/transaction.model');
  
  // Create transaction for payment
  const transaction = await Transaction.create({
    userId: patientId,
    amount: total,
    currency: 'USD',
    relatedProductId: orderItems[0]?.productId || null, // For backward compatibility
    relatedOrderId: order._id, // Link to order
    status: 'SUCCESS',
    provider: paymentMethod || 'DUMMY',
    providerReference: `ORD-${order.orderNumber || order._id}`
  });

  // Link transaction to order and update payment status
  order.transactionId = transaction._id;
  order.paymentStatus = 'PAID';
  await order.save();

  // Update product stock (only after successful payment)
  for (const item of items) {
    const product = products.find(p => p._id.toString() === item.productId.toString());
    product.stock -= item.quantity;
    await product.save();
  }

  // Credit seller (owner) balance
  const balanceService = require('./balance.service');
  try {
    const sellerAmount = subtotal; // Credit only the product subtotal, not shipping
    await balanceService.creditBalance(
      pharmacyData.ownerId.toString(),
      sellerAmount,
      'ORDER',
      {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        transactionId: transaction._id.toString()
      }
    );
  } catch (error) {
    // Log error but don't fail the order creation
    console.error('Error crediting seller balance for order:', error);
  }

  return order;
};

/**
 * Get order by ID
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID (for authorization check)
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Order
 */
const getOrderById = async (orderId, userId, userRole) => {
  const order = await Order.findById(orderId)
    .populate('patientId', 'fullName email phone')
    .populate('pharmacyId')
    .populate('ownerId', 'fullName email')
    .populate('items.productId')
    .populate('transactionId');

  if (!order) {
    throw new Error('Order not found');
  }

  // Authorization check
  if (userRole === 'PATIENT' && order.patientId._id.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only view your own orders');
  }

  if (userRole === 'DOCTOR' && order.ownerId._id.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only view orders for your pharmacy');
  }

  return order;
};

/**
 * Get orders for patient
 * @param {string} patientId - Patient ID
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Orders and pagination
 */
const getPatientOrders = async (patientId, options = {}) => {
  const { status, page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const query = { patientId };
  if (status) {
    query.status = status.toUpperCase();
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('pharmacyId', 'name logo')
      .populate('ownerId', 'fullName')
      .populate('items.productId', 'name images price discountPrice')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(query)
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get orders for pharmacy owner (doctor)
 * @param {string} ownerId - Pharmacy owner ID
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Orders and pagination
 */
const getPharmacyOrders = async (ownerId, options = {}) => {
  const { status, page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  // Ensure ownerId is an ObjectId for proper comparison
  const mongoose = require('mongoose');
  const ownerIdObj = mongoose.Types.ObjectId.isValid(ownerId) 
    ? new mongoose.Types.ObjectId(ownerId) 
    : ownerId;

  const query = { ownerId: ownerIdObj };
  if (status) {
    query.status = status.toUpperCase();
  }

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 getPharmacyOrders query:', {
      ownerId: ownerId,
      ownerIdObj: ownerIdObj.toString(),
      query,
      status,
    });
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('patientId', 'fullName email phone')
      .populate('pharmacyId', 'name')
      .populate('items.productId', 'name images price discountPrice')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(query)
  ]);

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ getPharmacyOrders result:', {
      ordersCount: orders.length,
      total,
      firstOrderOwnerId: orders[0]?.ownerId?.toString() || 'N/A',
    });
  }

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get all orders (admin only)
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Orders and pagination
 */
const getAllOrders = async (options = {}) => {
  const { status, pharmacyId, patientId, page = 1, limit = 10 } = options;
  const skip = (page - 1) * limit;

  const query = {};
  if (status) {
    query.status = status.toUpperCase();
  }
  if (pharmacyId) {
    query.pharmacyId = pharmacyId;
  }
  if (patientId) {
    query.patientId = patientId;
  }

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('patientId', 'fullName email phone')
      .populate('pharmacyId', 'name logo')
      .populate('ownerId', 'fullName email')
      .populate('items.productId', 'name images price discountPrice')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Order.countDocuments(query)
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Update order status
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 * @param {string} userId - User ID (for authorization)
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Updated order
 */
const updateOrderStatus = async (orderId, status, userId, userRole) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  // Authorization check
  if (userRole === 'DOCTOR' && order.ownerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only update orders for your pharmacy');
  }

  if (userRole !== 'ADMIN' && userRole !== 'DOCTOR') {
    throw new Error('Unauthorized: Only pharmacy owners and admins can update order status');
  }

  // Can only update status if order is paid
  if (order.paymentStatus !== 'PAID') {
    throw new Error('Cannot update order status until the order has been paid');
  }

  // Validate status transition
  const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
  if (!validStatuses.includes(status.toUpperCase())) {
    throw new Error(`Invalid status. Valid statuses: ${validStatuses.join(', ')}`);
  }

  order.status = status.toUpperCase();

  // Set deliveredAt when status is DELIVERED
  if (status.toUpperCase() === 'DELIVERED') {
    order.deliveredAt = new Date();
  }

  await order.save();

  return order;
};

/**
 * Update shipping fee for order
 * @deprecated Shipping fee is now set during checkout. This function is kept for backward compatibility but throws an error.
 */
const updateShippingFee = async (orderId, shippingFee, userId, userRole) => {
  throw new Error('Shipping fee cannot be updated. Payment is processed during checkout with the final shipping fee.');
};

/**
 * Pay for order
 * @deprecated Payment is now processed during checkout. This function is kept for backward compatibility but throws an error.
 */
const payForOrder = async (orderId, paymentMethod = 'DUMMY') => {
  const Order = require('../models/order.model');
  const order = await Order.findById(orderId);
  
  if (!order) {
    throw new Error('Order not found');
  }

  if (order.paymentStatus === 'PAID') {
    throw new Error('Order is already paid. Payment is processed during checkout.');
  }

  throw new Error('Payment must be processed during checkout. This endpoint is no longer used.');
};

/**
 * Cancel order
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Cancelled order
 */
const cancelOrder = async (orderId, userId, userRole) => {
  const order = await Order.findById(orderId)
    .populate('items.productId');

  if (!order) {
    throw new Error('Order not found');
  }

  // Authorization check
  if (userRole === 'PATIENT' && order.patientId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only cancel your own orders');
  }

  if (userRole === 'DOCTOR' && order.ownerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only cancel orders for your pharmacy');
  }

  // Can only cancel if order is PENDING or CONFIRMED
  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw new Error(`Cannot cancel order with status: ${order.status}`);
  }

  // Cannot cancel if order is already paid
  if (order.paymentStatus === 'PAID') {
    throw new Error('Cannot cancel an order that has already been paid');
  }

  // Restore product stock
  for (const item of order.items) {
    const product = item.productId;
    if (product) {
      product.stock += item.quantity;
      await product.save();
    }
  }

  order.status = 'CANCELLED';
  await order.save();

  return order;
};

/**
 * Link transaction to order
 * @param {string} orderId - Order ID
 * @param {string} transactionId - Transaction ID
 * @returns {Promise<Object>} Updated order
 */
const linkTransactionToOrder = async (orderId, transactionId) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  const transaction = await Transaction.findById(transactionId);

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  order.transactionId = transactionId;
  order.paymentStatus = transaction.status === 'SUCCESS' ? 'PAID' : 'PENDING';
  await order.save();

  return order;
};

module.exports = {
  createOrder,
  getOrderById,
  getPatientOrders,
  getPharmacyOrders,
  getAllOrders,
  updateOrderStatus,
  updateShippingFee,
  cancelOrder,
  linkTransactionToOrder,
  payForOrder
};

