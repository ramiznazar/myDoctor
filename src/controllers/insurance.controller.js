const insuranceService = require('../services/insurance.service');
const { asyncHandler } = require('../utils/asyncHandler');

/**
 * Get all insurance companies (admin)
 */
const getAllInsuranceCompanies = asyncHandler(async (req, res) => {
  const { isActive, page, limit } = req.query;
  
  const result = await insuranceService.getAllInsuranceCompanies({
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 100
  });

  res.status(200).json({
    success: true,
    data: result.companies,
    pagination: result.pagination
  });
});

/**
 * Get active insurance companies (public)
 */
const getActiveInsuranceCompanies = asyncHandler(async (req, res) => {
  const companies = await insuranceService.getActiveInsuranceCompanies();

  res.status(200).json({
    success: true,
    data: companies
  });
});

/**
 * Get insurance company by ID
 */
const getInsuranceCompanyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const company = await insuranceService.getInsuranceCompanyById(id);

  res.status(200).json({
    success: true,
    data: company
  });
});

/**
 * Create insurance company
 */
const createInsuranceCompany = asyncHandler(async (req, res) => {
  const company = await insuranceService.createInsuranceCompany(req.body);

  res.status(201).json({
    success: true,
    message: 'Insurance company created successfully',
    data: company
  });
});

/**
 * Update insurance company
 */
const updateInsuranceCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const company = await insuranceService.updateInsuranceCompany(id, req.body);

  res.status(200).json({
    success: true,
    message: 'Insurance company updated successfully',
    data: company
  });
});

/**
 * Delete insurance company
 */
const deleteInsuranceCompany = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await insuranceService.deleteInsuranceCompany(id);

  res.status(200).json({
    success: true,
    message: 'Insurance company deleted successfully'
  });
});

/**
 * Toggle insurance company status
 */
const toggleInsuranceCompanyStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;
  
  const company = await insuranceService.toggleInsuranceCompanyStatus(id, isActive);

  res.status(200).json({
    success: true,
    message: `Insurance company ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: company
  });
});

module.exports = {
  getAllInsuranceCompanies,
  getActiveInsuranceCompanies,
  getInsuranceCompanyById,
  createInsuranceCompany,
  updateInsuranceCompany,
  deleteInsuranceCompany,
  toggleInsuranceCompanyStatus
};
