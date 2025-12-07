const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /admin/doctors
 * @desc    Get all doctors with filtering and subscription info (admin only)
 * @access  Private (Admin only)
 * @query   status - Filter by doctor status (PENDING, APPROVED, REJECTED, BLOCKED)
 * @query   subscriptionStatus - Filter by subscription status (ACTIVE, EXPIRED, NONE)
 * @query   search - Search by name or email
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 10)
 */
router.get(
  '/doctors',
  authGuard(['ADMIN']),
  asyncHandler(userController.listDoctors)
);

module.exports = router;







