const asyncHandler = require('../middleware/asyncHandler');
const productService = require('../services/product.service');

/**
 * Create product
 */
exports.create = asyncHandler(async (req, res) => {
  const result = await productService.createProduct(req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update product
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await productService.updateProduct(req.params.id, req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get product by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await productService.getProduct(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List products with filtering
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await productService.listProducts(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Delete product
 */
exports.delete = asyncHandler(async (req, res) => {
  const result = await productService.deleteProduct(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

