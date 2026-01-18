const express = require('express');
const router = express.Router();
const insuranceController = require('../controllers/insurance.controller');
const {
  createInsuranceCompanyValidator,
  updateInsuranceCompanyValidator,
  toggleStatusValidator
} = require('../validators/insurance.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/insurance
 * @desc    Get active insurance companies (public)
 * @access  Public
 */
router.get(
  '/',
  asyncHandler(insuranceController.getActiveInsuranceCompanies)
);

/**
 * @route   GET /api/insurance/:id
 * @desc    Get insurance company by ID (public)
 * @access  Public
 */
router.get(
  '/:id',
  asyncHandler(insuranceController.getInsuranceCompanyById)
);


module.exports = router;
