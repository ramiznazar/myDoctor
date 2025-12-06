const express = require('express');
const router = express.Router();
const specializationController = require('../controllers/specialization.controller');
const {
  createSpecializationValidator,
  updateSpecializationValidator
} = require('../validators/specialization.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/specialization
 * @desc    Create specialization
 * @access  Private (Admin)
 */
router.post(
  '/',
  authGuard(['ADMIN']),
  validate(createSpecializationValidator),
  asyncHandler(specializationController.create)
);

/**
 * @route   PUT /api/specialization/:id
 * @desc    Update specialization
 * @access  Private (Admin)
 */
router.put(
  '/:id',
  authGuard(['ADMIN']),
  validate(updateSpecializationValidator),
  asyncHandler(specializationController.update)
);

/**
 * @route   GET /api/specialization
 * @desc    List all specializations
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(specializationController.list)
);

/**
 * @route   DELETE /api/specialization/:id
 * @desc    Delete specialization
 * @access  Private (Admin)
 */
router.delete(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(specializationController.delete)
);

module.exports = router;

