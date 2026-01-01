const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const adminController = require('../controllers/admin.controller');
const orderController = require('../controllers/order.controller');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const { filterOrdersValidator } = require('../validators/order.validators');

/**
 * @route   GET /admin/dashboard
 * @desc    Get dashboard statistics
 * @access  Private (Admin only)
 */
router.get(
  '/dashboard',
  authGuard(['ADMIN']),
  asyncHandler(adminController.getDashboardStats)
);

/**
 * @route   GET /admin/doctors
 * @desc    Get all doctors with filtering
 * @access  Private (Admin only)
 */
router.get(
  '/doctors',
  authGuard(['ADMIN']),
  asyncHandler(userController.listDoctors)
);

/**
 * @route   GET /admin/patients
 * @desc    Get all patients
 * @access  Private (Admin only)
 */
router.get(
  '/patients',
  authGuard(['ADMIN']),
  asyncHandler(adminController.getAllPatients)
);

/**
 * @route   GET /admin/appointments
 * @desc    Get all appointments
 * @access  Private (Admin only)
 */
router.get(
  '/appointments',
  authGuard(['ADMIN']),
  asyncHandler(adminController.getAllAppointments)
);

/**
 * @route   GET /admin/transactions
 * @desc    Get all transactions
 * @access  Private (Admin only)
 */
router.get(
  '/transactions',
  authGuard(['ADMIN']),
  asyncHandler(adminController.getAllTransactions)
);

/**
 * @route   GET /admin/products
 * @desc    Get all products
 * @access  Private (Admin only)
 */
router.get(
  '/products',
  authGuard(['ADMIN']),
  asyncHandler(adminController.getAllProducts)
);

/**
 * @route   GET /admin/pharmacies
 * @desc    Get all pharmacies
 * @access  Private (Admin only)
 */
router.get(
  '/pharmacies',
  authGuard(['ADMIN']),
  asyncHandler(adminController.getAllPharmacies)
);

/**
 * @route   GET /admin/specializations
 * @desc    Get all specializations
 * @access  Private (Admin only)
 */
router.get(
  '/specializations',
  authGuard(['ADMIN']),
  asyncHandler(adminController.getAllSpecializations)
);

/**
 * @route   PUT /admin/users/:id/status
 * @desc    Update user status
 * @access  Private (Admin only)
 */
router.put(
  '/users/:id/status',
  authGuard(['ADMIN']),
  asyncHandler(adminController.updateUserStatus)
);

/**
 * @route   DELETE /admin/users/:id
 * @desc    Delete user
 * @access  Private (Admin only)
 */
router.delete(
  '/users/:id',
  authGuard(['ADMIN']),
  asyncHandler(adminController.deleteUser)
);

/**
 * @route   POST /admin/notifications
 * @desc    Send notification to user
 * @access  Private (Admin only)
 */
router.post(
  '/notifications',
  authGuard(['ADMIN']),
  asyncHandler(adminController.sendNotification)
);

/**
 * @route   GET /admin/activity
 * @desc    Get system activity/logs
 * @access  Private (Admin only)
 */
router.get(
  '/activity',
  authGuard(['ADMIN']),
  asyncHandler(adminController.getSystemActivity)
);

/**
 * @route   GET /admin/reviews
 * @desc    Get all reviews (admin only)
 * @access  Private (Admin only)
 */
router.get(
  '/reviews',
  authGuard(['ADMIN']),
  asyncHandler(adminController.getAllReviews)
);

/**
 * @route   PUT /admin/profile
 * @desc    Update admin profile
 * @access  Private (Admin only)
 */
router.put(
  '/profile',
  authGuard(['ADMIN']),
  asyncHandler(adminController.updateProfile)
);

/**
 * @route   GET /admin/doctors/chat
 * @desc    Get all doctors for chat panel with unread message counts
 * @access  Private (Admin only)
 */
router.get(
  '/doctors/chat',
  authGuard(['ADMIN']),
  asyncHandler(adminController.getDoctorsForChat)
);

/**
 * @route   GET /admin/orders
 * @desc    Get all orders (admin only)
 * @access  Private (Admin only)
 */
router.get(
  '/orders',
  authGuard(['ADMIN']),
  validate(filterOrdersValidator),
  asyncHandler(orderController.getAllOrders)
);

module.exports = router;







