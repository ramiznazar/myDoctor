const InsuranceCompany = require('../models/insuranceCompany.model');

/**
 * Get all insurance companies
 * @param {Object} filter - Filter options (isActive, etc.)
 * @returns {Promise<Object>} Insurance companies and pagination
 */
const getAllInsuranceCompanies = async (filter = {}) => {
  const {
    isActive,
    page = 1,
    limit = 100
  } = filter;

  const query = {};
  
  if (isActive !== undefined) {
    query.isActive = isActive === true || isActive === 'true';
  }

  const skip = (page - 1) * limit;

  const [companies, total] = await Promise.all([
    InsuranceCompany.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    InsuranceCompany.countDocuments(query)
  ]);

  return {
    companies,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get active insurance companies (public)
 * @returns {Promise<Array>} Active insurance companies
 */
const getActiveInsuranceCompanies = async () => {
  return await InsuranceCompany.find({ isActive: true })
    .sort({ name: 1 });
};

/**
 * Get insurance company by ID
 * @param {string} id - Insurance company ID
 * @returns {Promise<Object>} Insurance company
 */
const getInsuranceCompanyById = async (id) => {
  const company = await InsuranceCompany.findById(id);
  
  if (!company) {
    throw new Error('Insurance company not found');
  }

  return company;
};

/**
 * Create insurance company
 * @param {Object} data - Insurance company data
 * @returns {Promise<Object>} Created insurance company
 */
const createInsuranceCompany = async (data) => {
  const { name, logo, isActive = true } = data;

  // Check if name already exists
  const existing = await InsuranceCompany.findOne({ name: name.trim() });
  if (existing) {
    throw new Error('Insurance company with this name already exists');
  }

  const company = await InsuranceCompany.create({
    name: name.trim(),
    logo: logo || null,
    isActive
  });

  return company;
};

/**
 * Update insurance company
 * @param {string} id - Insurance company ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated insurance company
 */
const updateInsuranceCompany = async (id, data) => {
  const company = await InsuranceCompany.findById(id);
  
  if (!company) {
    throw new Error('Insurance company not found');
  }

  // If name is being updated, check for duplicates
  if (data.name && data.name.trim() !== company.name) {
    const existing = await InsuranceCompany.findOne({ 
      name: data.name.trim(),
      _id: { $ne: id }
    });
    if (existing) {
      throw new Error('Insurance company with this name already exists');
    }
    company.name = data.name.trim();
  }

  if (data.logo !== undefined) {
    company.logo = data.logo;
  }

  if (data.isActive !== undefined) {
    company.isActive = data.isActive;
  }

  await company.save();
  return company;
};

/**
 * Delete insurance company
 * @param {string} id - Insurance company ID
 * @returns {Promise<Object>} Deleted insurance company
 */
const deleteInsuranceCompany = async (id) => {
  const company = await InsuranceCompany.findById(id);
  
  if (!company) {
    throw new Error('Insurance company not found');
  }

  // Check if any doctors are using this insurance company
  const DoctorProfile = require('../models/doctorProfile.model');
  const doctorsUsingInsurance = await DoctorProfile.countDocuments({
    insuranceCompanies: id
  });

  if (doctorsUsingInsurance > 0) {
    throw new Error(`Cannot delete insurance company. ${doctorsUsingInsurance} doctor(s) are currently using it. Please deactivate it instead.`);
  }

  await InsuranceCompany.findByIdAndDelete(id);
  return company;
};

/**
 * Toggle insurance company status (activate/deactivate)
 * @param {string} id - Insurance company ID
 * @param {boolean} isActive - Active status
 * @returns {Promise<Object>} Updated insurance company
 */
const toggleInsuranceCompanyStatus = async (id, isActive) => {
  const company = await InsuranceCompany.findById(id);
  
  if (!company) {
    throw new Error('Insurance company not found');
  }

  company.isActive = isActive;
  await company.save();
  return company;
};

module.exports = {
  getAllInsuranceCompanies,
  getActiveInsuranceCompanies,
  getInsuranceCompanyById,
  createInsuranceCompany,
  updateInsuranceCompany,
  deleteInsuranceCompany,
  toggleInsuranceCompanyStatus
};
