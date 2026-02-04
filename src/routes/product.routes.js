const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const {
  createProductValidator,
  updateProductValidator,
  filterProductsValidator
} = require('../validators/product.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/products
 * @desc    Create product
 * @access  Private (Pharmacy/Admin)
 */
router.post(
  '/',
  authGuard(['PHARMACY', 'PARAPHARMACY', 'ADMIN']),
  validate(createProductValidator),
  asyncHandler(productController.create)
);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Private (Pharmacy/Admin)
 */
router.put(
  '/:id',
  authGuard(['PHARMACY', 'PARAPHARMACY', 'ADMIN']),
  validate(updateProductValidator),
  asyncHandler(productController.update)
);

/**
 * @route   GET /api/products
 * @desc    List products with filtering
 * @access  Public
 */
router.get(
  '/',
  validate(filterProductsValidator),
  asyncHandler(productController.list)
);

/**
 * @route   GET /api/products/:id
 * @desc    Get product by ID
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(productController.getById)
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product
 * @access  Private (Pharmacy/Admin)
 */
router.delete(
  '/:id',
  authGuard(['PHARMACY', 'PARAPHARMACY', 'ADMIN']),
  asyncHandler(productController.delete)
);

module.exports = router;

