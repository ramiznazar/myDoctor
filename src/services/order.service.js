const Order = require('../models/order.model');
const Product = require('../models/product.model');
const Pharmacy = require('../models/pharmacy.model');
const User = require('../models/user.model');
const Transaction = require('../models/transaction.model');
const notificationService = require('./notification.service');
const {
  DELIVERY_DAY_OPTIONS,
  DELIVERY_STATUS,
  DELIVERY_PERFORMANCE,
  isValidDeliveryDays,
  calculateExpectedDeliveryDate,
  deriveDeliveryMonitoring,
} = require('../utils/deliveryMonitoring');

const notify = async (userId, title, body, data) => {
  try {
    await notificationService.createNotification({ userId, title, body, type: 'PAYMENT', data });
  } catch (error) {
    // A notification failure must never roll back a legitimate order update.
    console.error('Unable to create order notification:', error.message);
  }
};

const toPlainOrder = (order) => (order?.toObject ? order.toObject() : order);

// Keep delivery status accurate without a background job. This mirrors the
// Veterinary order flow and persists a changed monitoring state for reports.
const refreshDeliveryMonitoring = async (orders) => {
  if (!Array.isArray(orders) || orders.length === 0) return orders || [];

  const now = new Date();
  const operations = [];
  const monitored = orders.map((source) => {
    const order = toPlainOrder(source);
    const monitoring = deriveDeliveryMonitoring(order, now);
    const changed = order.deliveryStatus !== monitoring.deliveryStatus
      || order.deliveryPerformance !== monitoring.deliveryPerformance
      || order.totalActualDeliveryDays !== monitoring.totalActualDeliveryDays;

    if (changed && order?._id) {
      operations.push({
        updateOne: {
          filter: { _id: order._id },
          update: { $set: {
            deliveryStatus: monitoring.deliveryStatus,
            deliveryPerformance: monitoring.deliveryPerformance,
            totalActualDeliveryDays: monitoring.totalActualDeliveryDays,
          } },
        },
      });
    }
    return { ...order, ...monitoring };
  });

  if (operations.length) await Order.bulkWrite(operations, { ordered: false });
  return monitored;
};

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

  // The delivery address is a snapshot for this order.  Patients can use a
  // newly supplied address or the saved profile address, but an order is never
  // created without a complete destination for the seller.
  const normalizeShippingAddress = (address = {}) => ({
    line1: String(address?.line1 || '').trim(),
    line2: String(address?.line2 || '').trim() || null,
    city: String(address?.city || '').trim(),
    state: String(address?.state || '').trim(),
    country: String(address?.country || '').trim(),
    zip: String(address?.zip || '').trim(),
  });
  const hasRequestedAddress = ['line1', 'line2', 'city', 'state', 'country', 'zip']
    .some((field) => Boolean(String(shippingAddress?.[field] || '').trim()));
  const normalizedAddress = hasRequestedAddress
    ? normalizeShippingAddress(shippingAddress)
    : normalizeShippingAddress(patient.address);
  if (![normalizedAddress.line1, normalizedAddress.city, normalizedAddress.state, normalizedAddress.country, normalizedAddress.zip].every(Boolean)) {
    const error = new Error('A complete delivery address is required. Save an address in your profile or provide one for this order.');
    error.statusCode = 400;
    throw error;
  }

  // Get all products and calculate totals
  const productIds = items.map(item => item.productId);
  const products = await Product.find({ _id: { $in: productIds } });

  if (products.length !== productIds.length) {
    throw new Error('One or more products not found');
  }

  // Group products by pharmacy/owner. Prices, variant attributes and shipping
  // commitments are snapshotted in the order so later product edits cannot
  // change an order a patient has already reviewed.
  const pharmacyMap = new Map();

  for (const item of items) {
    const product = products.find(p => p._id.toString() === item.productId.toString());
    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const selectedVariant = item.variantId
      ? variants.find((variant) => String(variant._id) === String(item.variantId))
      : (variants.find((variant) => variant.isDefault) || variants[0] || null);
    if (item.variantId && !selectedVariant) throw new Error(`Selected variant is no longer available for ${product.name}`);
    if (selectedVariant?.isActive === false) throw new Error(`Selected variant is no longer available for ${product.name}`);
    const availableStock = selectedVariant ? selectedVariant.stock : product.stock;
    if (availableStock < item.quantity) throw new Error(`Insufficient stock for product ${product.name}. Available: ${availableStock}, requested: ${item.quantity}`);

    if (product.requiresPrescription) {
      const prescriptionService = require('./productPrescriptionRequest.service');
      const approved = await prescriptionService.hasApprovedPrescription(patientId, product._id, selectedVariant?._id || null);
      if (!approved) {
        const error = new Error(`An approved prescription is required before purchasing ${product.name}`);
        error.statusCode = 403;
        throw error;
      }
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

    const itemPrice = selectedVariant ? (selectedVariant.discountPrice ?? selectedVariant.price) : (product.discountPrice ?? product.price);
    const itemTotal = itemPrice * item.quantity;

    pharmacyMap.get(pharmacyId).items.push({
      productId: product._id,
      variantId: selectedVariant?._id || null,
      variantName: selectedVariant?.name || null,
      variantSnapshot: selectedVariant ? {
        strengthValue: selectedVariant.strengthValue ?? null,
        strengthUnit: selectedVariant.strengthUnit ?? null,
        dosageForm: selectedVariant.dosageForm ?? null,
        packageType: selectedVariant.packageType ?? null,
        unitsPerPack: selectedVariant.unitsPerPack ?? null,
        unitLabel: selectedVariant.unitLabel ?? null,
        packageDescription: selectedVariant.packageDescription ?? null,
        sku: selectedVariant.sku ?? null,
      } : {},
      quantity: item.quantity,
      price: selectedVariant?.price ?? product.price,
      discountPrice: selectedVariant?.discountPrice ?? product.discountPrice,
      total: itemTotal
    });
  }

  const createdOrders = [];
  for (const pharmacyData of Array.from(pharmacyMap.values())) {
    const requestedAt = new Date();
    const orderItems = pharmacyData.items;
    const orderSubtotal = orderItems.reduce((sum, i) => sum + (i.total || 0), 0);
    const tax = 0;
    // Shipping belongs to a specific order: it is set by the owning seller
    // after the order request, not inherited from a pharmacy profile.
    const initialShipping = 0;
    const initialTotal = orderSubtotal + initialShipping;

    // Create order with PENDING status (no payment yet)
    // Owner will set final shipping fee, then patient will pay
    const order = await Order.create({
      patientId,
      pharmacyId: pharmacyData.pharmacyId,
      ownerId: pharmacyData.ownerId,
      items: orderItems,
      subtotal: orderSubtotal,
      tax,
      shipping: initialShipping,
      initialShipping: initialShipping,
      finalShipping: null,
      total: initialTotal,
      initialTotal: initialTotal,
      shippingAddress: normalizedAddress,
      paymentMethod: null,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      requestedAt,
      ownerReadAt: null,
      // The patient created this order, so it is already viewed on their side.
      patientReadAt: new Date()
    });

    createdOrders.push(order);
    await notify(
      pharmacyData.ownerId,
      'New order received',
      `A new order (${order.orderNumber}) is waiting for its shipping fee and delivery commitment.`,
      { orderId: order._id.toString(), orderNumber: order.orderNumber, event: 'ORDER_CREATED' }
    );
  }

  return createdOrders.length === 1 ? createdOrders[0] : { orders: createdOrders };
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

  if ((userRole === 'PHARMACY' || userRole === 'PARAPHARMACY') && order.ownerId._id.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only view orders for your pharmacy');
  }

  if (userRole === 'PATIENT' && !order.patientReadAt) {
    await Order.updateOne({ _id: order._id }, { $set: { patientReadAt: new Date() } });
  }
  if ((userRole === 'PHARMACY' || userRole === 'PARAPHARMACY') && !order.ownerReadAt) {
    await Order.updateOne({ _id: order._id }, { $set: { ownerReadAt: new Date() } });
  }

  const [monitoredOrder] = await refreshDeliveryMonitoring([order]);
  return monitoredOrder;
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

  // Loading the order list is an explicit acknowledgement of any order
  // updates for this patient.  The count endpoint intentionally does not do
  // this, so rendering a sidebar never clears the indicator.
  if (orders.length) {
    await Order.updateMany(
      { _id: { $in: orders.map((order) => order._id) }, patientReadAt: null },
      { $set: { patientReadAt: new Date() } }
    );
  }

  const monitoredOrders = await refreshDeliveryMonitoring(orders);

  return {
    orders: monitoredOrders,
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

  if (orders.length) {
    await Order.updateMany(
      { _id: { $in: orders.map((order) => order._id) }, ownerReadAt: null },
      { $set: { ownerReadAt: new Date() } }
    );
  }

  const monitoredOrders = await refreshDeliveryMonitoring(orders);

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ getPharmacyOrders result:', {
      ordersCount: orders.length,
      total,
      firstOrderOwnerId: orders[0]?.ownerId?.toString() || 'N/A',
    });
  }

  return {
    orders: monitoredOrders,
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

  const monitoredOrders = await refreshDeliveryMonitoring(orders);

  return {
    orders: monitoredOrders,
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
  if ((userRole === 'PHARMACY' || userRole === 'PARAPHARMACY') && order.ownerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only update orders for your pharmacy');
  }

  if (userRole !== 'ADMIN' && userRole !== 'PHARMACY' && userRole !== 'PARAPHARMACY') {
    throw new Error('Unauthorized: Only pharmacy owners and admins can update order status');
  }

  // Can only update status if order is paid (except for CANCELLED)
  if (order.paymentStatus !== 'PAID' && status.toUpperCase() !== 'CANCELLED') {
    throw new Error('Cannot update order status until the order has been paid');
  }

  // Validate status transition
  const validStatuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
  if (!validStatuses.includes(status.toUpperCase())) {
    throw new Error(`Invalid status. Valid statuses: ${validStatuses.join(', ')}`);
  }

  order.status = status.toUpperCase();
  order.patientReadAt = null;
  order.ownerReadAt = new Date();

  // Delivery performance is calculated from the seller's dated commitment.
  if (status.toUpperCase() === 'DELIVERED') {
    order.deliveredAt = new Date();
    order.actualDeliveredAt = order.deliveredAt;
  }
  const monitoring = deriveDeliveryMonitoring(order);
  order.deliveryStatus = monitoring.deliveryStatus;
  order.deliveryPerformance = monitoring.deliveryPerformance;
  order.totalActualDeliveryDays = monitoring.totalActualDeliveryDays;

  await order.save();
  await notify(
    order.patientId,
    'Order status updated',
    `Your order ${order.orderNumber} is now ${order.status.toLowerCase()}.`,
    { orderId: order._id.toString(), orderNumber: order.orderNumber, event: 'STATUS_UPDATED' }
  );

  return order;
};

/**
 * Update shipping fee for order
 * Only pharmacy owner (doctor) can update shipping fee
 * This must be done before patient pays
 * @param {string} orderId - Order ID
 * @param {number} shippingFee - Final shipping fee
 * @param {string} userId - User ID (for authorization)
 * @param {string} userRole - User role
 * @returns {Promise<Object>} Updated order
 */
const updateShippingFee = async (orderId, shippingFee, deliveryDays, userId, userRole) => {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  // Authorization check - only pharmacy owner can update shipping
  if ((userRole !== 'PHARMACY' && userRole !== 'PARAPHARMACY') || order.ownerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: Only the pharmacy owner can update shipping fee');
  }

  // Cannot update shipping if order is already paid
  if (order.paymentStatus === 'PAID') {
    throw new Error('Cannot update shipping fee for an order that has already been paid');
  }

  // Validate shipping fee
  if (typeof shippingFee !== 'number' || shippingFee < 0) {
    throw new Error('Shipping fee must be a non-negative number');
  }
  if (!isValidDeliveryDays(deliveryDays)) {
    throw new Error(`Expected delivery time is required and must be one of: ${DELIVERY_DAY_OPTIONS.join(', ')} days`);
  }

  // Shipping is quoted for this specific order and unlocks the patient payment
  // step only once the delivery commitment has been supplied too.
  const finalShipping = shippingFee;
  const finalTotal = (Number(order.subtotal) || 0) + finalShipping;
  const shippingFeeAddedAt = new Date();

  order.tax = 0;
  order.shipping = finalShipping;
  order.finalShipping = finalShipping;
  order.total = finalTotal;
  order.shippingUpdatedAt = shippingFeeAddedAt;
  order.pharmacyAcceptedAt = order.pharmacyAcceptedAt || shippingFeeAddedAt;
  order.shippingFeeAddedAt = shippingFeeAddedAt;
  order.promisedDeliveryDays = Number(deliveryDays);
  order.expectedDeliveryDate = calculateExpectedDeliveryDate(shippingFeeAddedAt, deliveryDays);
  order.deliveryStatus = DELIVERY_STATUS.ON_TIME;
  order.deliveryPerformance = DELIVERY_PERFORMANCE.PENDING;
  order.totalActualDeliveryDays = null;
  order.requiresPaymentUpdate = false;
  order.patientReadAt = null;
  order.ownerReadAt = new Date();

  await order.save();
  await notify(
    order.patientId,
    'Shipping fee updated',
    `Shipping and delivery details for order ${order.orderNumber} are ready for payment.`,
    { orderId: order._id.toString(), orderNumber: order.orderNumber, event: 'SHIPPING_UPDATED' }
  );

  return order;
};

/**
 * Pay for order
 * Patient pays for order after doctor has set the shipping fee
 * @param {string} orderId - Order ID
 * @param {string} userId - User ID (for authorization)
 * @param {string} userRole - User role
 * @param {string} paymentMethod - Payment method
 * @returns {Promise<Object>} Updated order
 */
const payForOrder = async (orderId, userId, userRole, paymentMethod = 'STRIPE') => {
  const balanceService = require('./balance.service');
  
  const order = await Order.findById(orderId)
    .populate('items.productId')
    .populate('ownerId');

  if (!order) {
    throw new Error('Order not found');
  }

  // Only the owning patient can pay for an order.
  if (userRole !== 'PATIENT') {
    throw new Error('Unauthorized: Only patients can pay for orders');
  }
  if (order.patientId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only pay for your own orders');
  }

  if (order.paymentStatus === 'PAID') {
    throw new Error('Order is already paid');
  }

  // Validate that shipping fee has been set by doctor
  if (order.finalShipping === null || order.finalShipping === undefined || !order.pharmacyAcceptedAt || !isValidDeliveryDays(order.promisedDeliveryDays)) {
    const error = new Error('Shipping fee and delivery commitment must be set by the pharmacy owner before payment');
    error.statusCode = 400;
    throw error;
  }

  if (paymentMethod && String(paymentMethod).toUpperCase() !== 'STRIPE') {
    throw new Error('Only STRIPE payment method is supported');
  }

  const normalizedSubtotal = Number(order.subtotal) || 0;
  const normalizedShipping = Number(order.finalShipping ?? order.shipping) || 0;
  const computedTotal = normalizedSubtotal + normalizedShipping;

  order.tax = 0;
  order.shipping = normalizedShipping;
  order.finalShipping = normalizedShipping;
  order.total = computedTotal;

  // Reserve stock before committing the payment record.  The previous order
  // saved a PAID transaction first and only then noticed an out-of-stock
  // product, which could leave a failed checkout recorded as paid.  Each
  // update is conditional on the remaining stock so two concurrent payments
  // cannot oversell the same option.
  const reservedItems = [];
  let transaction = null;
  try {
    for (const item of order.items) {
      const product = item.productId;
      if (!product) throw new Error('A product in this order is no longer available');

      const quantity = Number(item.quantity);
      const variantId = item.variantId ? String(item.variantId) : null;
      const reservationQuery = variantId
        ? {
            _id: product._id,
            variants: { $elemMatch: { _id: variantId, isActive: { $ne: false }, stock: { $gte: quantity } } }
          }
        : { _id: product._id, stock: { $gte: quantity } };
      const reservationUpdate = variantId
        ? { $inc: { 'variants.$.stock': -quantity, stock: -quantity } }
        : { $inc: { stock: -quantity } };
      const reserved = await Product.updateOne(reservationQuery, reservationUpdate);
      if (reserved.modifiedCount !== 1) {
        throw new Error(`Insufficient stock for product ${product.name}. Please refresh your cart and try again.`);
      }
      reservedItems.push({ productId: product._id, variantId, quantity });
    }

    transaction = await Transaction.create({
      userId: order.patientId,
      amount: computedTotal,
      currency: 'EUR',
      relatedOrderId: orderId,
      status: 'SUCCESS',
      provider: 'STRIPE',
      providerReference: `ORD-${Date.now()}-${orderId}`
    });

    order.paymentStatus = 'PAID';
    order.status = 'CONFIRMED';
    order.paymentMethod = 'STRIPE';
    order.transactionId = transaction._id;
    order.customerPaidAt = new Date();
    order.ownerReadAt = null;
    order.patientReadAt = new Date();
    await order.save();
  } catch (error) {
    // Restore only stock that this request actually reserved. This gives a
    // failed payment attempt no observable inventory side effect.
    await Promise.allSettled(reservedItems.map((item) => Product.updateOne(
      item.variantId
        ? { _id: item.productId, 'variants._id': item.variantId }
        : { _id: item.productId },
      item.variantId
        ? { $inc: { 'variants.$.stock': item.quantity, stock: item.quantity } }
        : { $inc: { stock: item.quantity } }
    )));
    if (transaction?._id) await Transaction.deleteOne({ _id: transaction._id });
    throw error;
  }

  // Credit seller balance (pharmacy owner/doctor)
  try {
    await balanceService.creditBalance(
      order.ownerId._id.toString(),
      computedTotal,
      'PRODUCT',
      {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        transactionId: transaction._id.toString()
      }
    );
  } catch (error) {
    console.error('Error crediting seller balance:', error);
    // Log error but don't fail the payment - balance can be credited later
  }

  await notify(
    order.ownerId._id || order.ownerId,
    'Order paid',
    `Order ${order.orderNumber} has been paid and is ready to process.`,
    { orderId: order._id.toString(), orderNumber: order.orderNumber, event: 'ORDER_PAID' }
  );

  return order;
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

  if ((userRole === 'PHARMACY' || userRole === 'PARAPHARMACY') && order.ownerId.toString() !== userId.toString()) {
    throw new Error('Unauthorized: You can only cancel orders for your pharmacy');
  }

  if (!['PATIENT', 'PHARMACY', 'PARAPHARMACY', 'ADMIN'].includes(userRole)) {
    throw new Error('Unauthorized: Only the patient, pharmacy owner or an administrator can cancel an order');
  }

  // Can only cancel if order is PENDING or CONFIRMED
  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw new Error(`Cannot cancel order with status: ${order.status}`);
  }

  // Cannot cancel if order is already paid
  if (order.paymentStatus === 'PAID') {
    throw new Error('Cannot cancel an order that has already been paid');
  }

  // Stock is deducted only after payment. Restore it only for a paid order
  // that has not been shipped, otherwise cancelling an unpaid quote inflates
  // inventory.
  if (order.paymentStatus === 'PAID' && order.status !== 'SHIPPED') {
    for (const item of order.items) {
      const product = item.productId;
      if (product) {
        const variant = item.variantId && Array.isArray(product.variants)
          ? product.variants.id(item.variantId)
          : null;
        if (variant) {
          variant.stock += item.quantity;
          product.stock = product.variants.filter((entry) => entry.isActive !== false)
            .reduce((total, entry) => total + Number(entry.stock || 0), 0);
        } else {
          product.stock += item.quantity;
        }
        await product.save();
      }
    }
  }

  order.status = 'CANCELLED';
  const cancelledByPatient = userRole === 'PATIENT';
  order.patientReadAt = cancelledByPatient ? new Date() : null;
  order.ownerReadAt = cancelledByPatient ? null : new Date();
  await order.save();

  await notify(
    cancelledByPatient ? order.ownerId : order.patientId,
    'Order cancelled',
    `Order ${order.orderNumber} has been cancelled.`,
    { orderId: order._id.toString(), orderNumber: order.orderNumber, event: 'ORDER_CANCELLED' }
  );

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

/**
 * Return a role-scoped unread order count.  It is separate from notifications
 * because a count must remain correct even if a delivery notification fails.
 */
const getUnreadCount = async (userId, userRole) => {
  if (userRole === 'PATIENT') {
    return Order.countDocuments({ patientId: userId, patientReadAt: null });
  }
  if (userRole === 'PHARMACY' || userRole === 'PARAPHARMACY') {
    return Order.countDocuments({ ownerId: userId, ownerReadAt: null });
  }
  return 0;
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
  payForOrder,
  getUnreadCount
};

