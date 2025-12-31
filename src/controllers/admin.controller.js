const asyncHandler = require('../middleware/asyncHandler');
const adminService = require('../services/admin.service');
const userService = require('../services/user.service');
const notificationService = require('../services/notification.service');

/**
 * Get admin dashboard statistics
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const result = await adminService.getDashboardStats();
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get all patients
 */
exports.getAllPatients = asyncHandler(async (req, res) => {
  const result = await userService.listUsers({ ...req.query, role: 'PATIENT' });
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get all appointments
 */
exports.getAllAppointments = asyncHandler(async (req, res) => {
  const appointmentService = require('../services/appointment.service');
  const result = await appointmentService.listAppointments(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get all transactions (payment-related only)
 */
exports.getAllTransactions = asyncHandler(async (req, res) => {
  const result = await adminService.getAllPaymentTransactions(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get all products
 */
exports.getAllProducts = asyncHandler(async (req, res) => {
  const productService = require('../services/product.service');
  const result = await productService.listProducts(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get all pharmacies
 * For admin panel, optionally filter by owner role
 */
exports.getAllPharmacies = asyncHandler(async (req, res) => {
  const pharmacyService = require('../services/pharmacy.service');
  const User = require('../models/user.model');
  
  // If ownerRole filter is provided, filter at database level
  if (req.query.ownerRole) {
    // Get all users with the specified role
    const usersWithRole = await User.find({ role: req.query.ownerRole }).select('_id');
    const userIds = usersWithRole.map(u => u._id);
    
    // If no users with that role exist, return empty result
    if (userIds.length === 0) {
      return res.json({ 
        success: true, 
        message: 'OK', 
        data: {
          pharmacies: [],
          pagination: {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            total: 0,
            pages: 0
          }
        }
      });
    }
    
    // Add ownerId filter to query using $in operator
    const modifiedQuery = {
      ...req.query,
      ownerId: { $in: userIds }
    };
    
    // Remove ownerRole from query as it's not a pharmacy field
    delete modifiedQuery.ownerRole;
    
    const result = await pharmacyService.listPharmacies(modifiedQuery);
    res.json({ success: true, message: 'OK', data: result });
  } else {
    // No role filter, return all pharmacies
    const result = await pharmacyService.listPharmacies(req.query);
    res.json({ success: true, message: 'OK', data: result });
  }
});

/**
 * Get all specializations
 */
exports.getAllSpecializations = asyncHandler(async (req, res) => {
  const specializationService = require('../services/specialization.service');
  const result = await specializationService.listSpecializations();
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update user status
 */
exports.updateUserStatus = asyncHandler(async (req, res) => {
  const result = await userService.updateStatus(req.params.id, req.body.status);
  res.json({ success: true, message: 'User status updated', data: result });
});

/**
 * Delete user
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  const result = await adminService.deleteUser(req.params.id);
  res.json({ success: true, message: 'User deleted', data: result });
});

/**
 * Send notification
 */
exports.sendNotification = asyncHandler(async (req, res) => {
  const result = await notificationService.createNotification(req.body);
  res.json({ success: true, message: 'Notification sent', data: result });
});

/**
 * Get system activity
 */
exports.getSystemActivity = asyncHandler(async (req, res) => {
  const result = await adminService.getSystemActivity(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get all reviews (admin only)
 */
exports.getAllReviews = asyncHandler(async (req, res) => {
  const result = await adminService.getAllReviews(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get all payment transactions only
 */
exports.getAllPaymentTransactions = asyncHandler(async (req, res) => {
  const result = await adminService.getAllPaymentTransactions(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update admin profile
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const result = await userService.updateUserProfile(req.userId, req.body);
  res.json({ success: true, message: 'Profile updated successfully', data: result });
});

/**
 * Get all doctors for chat panel with unread message counts
 */
exports.getDoctorsForChat = asyncHandler(async (req, res) => {
  const result = await adminService.getDoctorsForChat(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});






