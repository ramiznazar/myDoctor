const asyncHandler = require('../middleware/asyncHandler');
const blogService = require('../services/blog.service');

/**
 * Create blog post
 */
exports.create = asyncHandler(async (req, res) => {
  const blogData = {
    ...req.body,
    authorId: req.userId
  };
  const result = await blogService.createBlogPost(blogData);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update blog post
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await blogService.updateBlogPost(req.params.id, req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get blog post by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await blogService.getBlogPost(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List blog posts with filtering
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await blogService.listBlogPosts(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Delete blog post
 */
exports.delete = asyncHandler(async (req, res) => {
  const result = await blogService.deleteBlogPost(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

