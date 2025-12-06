const asyncHandler = require('../middleware/asyncHandler');
const userService = require('../services/user.service');

/**
 * Get user by ID
 */
exports.getUserById = asyncHandler(async (req, res) => {
  const result = await userService.getUserById(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update user profile
 */
exports.updateProfile = asyncHandler(async (req, res) => {
  const result = await userService.updateUserProfile(req.userId, req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update user status (admin only)
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const result = await userService.updateStatus(req.params.id, req.body.status);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List users with filtering
 */
exports.listUsers = asyncHandler(async (req, res) => {
  const result = await userService.listUsers(req.query);
  res.json({ success: true, message: 'OK', data: result });
});
