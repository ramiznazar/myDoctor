const asyncHandler = require('../middleware/asyncHandler');
const productService = require('../services/product.service');

/**
 * Create product
 * Automatically sets sellerId and sellerType from authenticated user
 * Doctors must have FULL subscription plan to create products
 */
exports.create = asyncHandler(async (req, res) => {
  // Automatically set sellerId and sellerType from authenticated user
  const productData = {
    ...req.body,
    sellerId: req.userId,
    sellerType: req.userRole
  };
  
  const result = await productService.createProduct(productData);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update product
 * Doctors must have FULL subscription to update products
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await productService.updateProduct(req.params.id, req.body, req.userId);
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
  const result = await productService.deleteProduct(req.params.id, req.userId);
  res.json({ success: true, message: 'OK', data: result });
});

