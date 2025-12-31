const Pharmacy = require('../models/pharmacy.model');
const User = require('../models/user.model');

/**
 * Create pharmacy
 * @param {Object} data - Pharmacy data
 * @returns {Promise<Object>} Created pharmacy
 */
const createPharmacy = async (data) => {
  const { ownerId, name, logo, address, phone, location, isActive } = data;

  // Verify owner exists
  const owner = await User.findById(ownerId);
  if (!owner) {
    throw new Error('Owner not found');
  }

  const pharmacy = await Pharmacy.create({
    ownerId,
    name,
    logo,
    address: address || {},
    phone,
    location: location || {},
    isActive: isActive !== undefined ? isActive : true
  });

  return pharmacy;
};

/**
 * Update pharmacy
 * @param {string} id - Pharmacy ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated pharmacy
 */
const updatePharmacy = async (id, data) => {
  const pharmacy = await Pharmacy.findById(id);
  
  if (!pharmacy) {
    throw new Error('Pharmacy not found');
  }

  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      if (key === 'address' || key === 'location') {
        pharmacy[key] = { ...pharmacy[key], ...data[key] };
      } else {
        pharmacy[key] = data[key];
      }
    }
  });

  await pharmacy.save();

  return pharmacy;
};

/**
 * Get pharmacy by ID
 * @param {string} id - Pharmacy ID
 * @returns {Promise<Object>} Pharmacy
 */
const getPharmacy = async (id) => {
  const pharmacy = await Pharmacy.findById(id)
    .populate('ownerId', 'fullName email phone profileImage');
  
  if (!pharmacy) {
    throw new Error('Pharmacy not found');
  }

  return pharmacy;
};

/**
 * Get pharmacy by owner ID
 * @param {string} ownerId - Owner User ID
 * @returns {Promise<Object|null>} Pharmacy or null if not found
 */
const getPharmacyByOwnerId = async (ownerId) => {
  const pharmacy = await Pharmacy.findOne({ ownerId, isActive: true })
    .populate('ownerId', 'fullName email phone profileImage');
  
  return pharmacy;
};

/**
 * List pharmacies with filtering
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Pharmacies and pagination info
 */
const listPharmacies = async (filter = {}) => {
  const {
    ownerId,
    city,
    search,
    page = 1,
    limit = 10
  } = filter;

  const query = { isActive: true };

  if (ownerId) {
    // Handle both single ownerId and $in operator for multiple ownerIds
    if (typeof ownerId === 'object' && ownerId.$in) {
      query.ownerId = { $in: ownerId.$in };
    } else {
      query.ownerId = ownerId;
    }
  }

  if (city) {
    query['address.city'] = { $regex: city, $options: 'i' };
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { 'address.city': { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (page - 1) * limit;

  const [pharmacies, total] = await Promise.all([
    Pharmacy.find(query)
      .populate('ownerId', 'fullName email phone profileImage')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Pharmacy.countDocuments(query)
  ]);

  return {
    pharmacies,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Delete pharmacy
 * @param {string} id - Pharmacy ID
 * @returns {Promise<Object>} Success message
 */
const deletePharmacy = async (id) => {
  const pharmacy = await Pharmacy.findById(id);
  
  if (!pharmacy) {
    throw new Error('Pharmacy not found');
  }

  await Pharmacy.findByIdAndDelete(id);

  return { message: 'Pharmacy deleted successfully' };
};

module.exports = {
  createPharmacy,
  updatePharmacy,
  getPharmacy,
  getPharmacyByOwnerId,
  listPharmacies,
  deletePharmacy
};

