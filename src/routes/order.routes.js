const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const {
  createOrderValidator,
  updateOrderStatusValidator,
  filterOrdersValidator,
  getOrderByIdValidator,
  updateShippingFeeValidator,
  payForOrderValidator,
  cancelOrderValidator
} = require('../validators/order.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/orders
 * @desc    Create order
 * @access  Private (Patient)
 */
router.post(
  '/',
  authGuard(['PATIENT']),
  validate(createOrderValidator),
  asyncHandler(orderController.create)
);

/**
 * @route   GET /api/orders
 * @desc    Get user orders (Patient gets their orders, Doctor gets their pharmacy orders)
 * @access  Private (Patient, Doctor)
 */
router.get(
  '/',
  authGuard(['PATIENT', 'DOCTOR']),
  validate(filterOrdersValidator),
  asyncHandler(async (req, res) => {
    if (req.userRole === 'PATIENT') {
      return orderController.getPatientOrders(req, res);
    } else if (req.userRole === 'DOCTOR') {
      return orderController.getPharmacyOrders(req, res);
    }
  })
);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by ID
 * @access  Private (Patient, Doctor, Admin)
 */
router.get(
  '/:id',
  authGuard(['PATIENT', 'DOCTOR', 'ADMIN']),
  validate(getOrderByIdValidator),
  asyncHandler(orderController.getById)
);

/**
 * @route   PUT /api/orders/:id/status
 * @desc    Update order status
 * @access  Private (Doctor, Admin)
 */
router.put(
  '/:id/status',
  authGuard(['DOCTOR', 'ADMIN']),
  validate(updateOrderStatusValidator),
  asyncHandler(orderController.updateStatus)
);

/**
 * @route   PUT /api/orders/:id/shipping
 * @desc    Update shipping fee
 * @access  Private (Doctor, Admin)
 */
router.put(
  '/:id/shipping',
  authGuard(['DOCTOR', 'ADMIN']),
  validate(updateShippingFeeValidator),
  asyncHandler(orderController.updateShippingFee)
);

/**
 * @route   POST /api/orders/:id/pay
 * @desc    Pay for order (including shipping difference if any)
 * @access  Private (Patient)
 */
router.post(
  '/:id/pay',
  authGuard(['PATIENT']),
  validate(payForOrderValidator),
  asyncHandler(orderController.payForOrder)
);

/**
 * @route   POST /api/orders/:id/cancel
 * @desc    Cancel order
 * @access  Private (Patient, Doctor, Admin)
 */
router.post(
  '/:id/cancel',
  authGuard(['PATIENT', 'DOCTOR', 'ADMIN']),
  validate(cancelOrderValidator),
  asyncHandler(orderController.cancel)
);

/**
 * @route   GET /api/pharmacy/orders
 * @desc    Get pharmacy orders (for pharmacy owner)
 * @access  Private (Doctor)
 */
router.get(
  '/pharmacy/orders',
  authGuard(['DOCTOR']),
  validate(filterOrdersValidator),
  asyncHandler(orderController.getPharmacyOrders)
);

module.exports = router;

