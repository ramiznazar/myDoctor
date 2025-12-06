const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blog.controller');
const {
  createBlogPostValidator,
  updateBlogPostValidator,
  filterBlogPostsValidator
} = require('../validators/blog.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/blog
 * @desc    Create blog post
 * @access  Private (Doctor/Admin)
 */
router.post(
  '/',
  authGuard(['DOCTOR', 'ADMIN']),
  validate(createBlogPostValidator),
  asyncHandler(blogController.create)
);

/**
 * @route   PUT /api/blog/:id
 * @desc    Update blog post
 * @access  Private (Doctor/Admin)
 */
router.put(
  '/:id',
  authGuard(['DOCTOR', 'ADMIN']),
  validate(updateBlogPostValidator),
  asyncHandler(blogController.update)
);

/**
 * @route   GET /api/blog
 * @desc    List blog posts with filtering
 * @access  Public
 */
router.get(
  '/',
  validate(filterBlogPostsValidator),
  asyncHandler(blogController.list)
);

/**
 * @route   GET /api/blog/:id
 * @desc    Get blog post by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(blogController.getById)
);

/**
 * @route   DELETE /api/blog/:id
 * @desc    Delete blog post
 * @access  Private (Doctor/Admin)
 */
router.delete(
  '/:id',
  authGuard(['DOCTOR', 'ADMIN']),
  asyncHandler(blogController.delete)
);

module.exports = router;

