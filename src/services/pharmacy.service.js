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
 * Get pharmacy by owner ID (any owner status)
 * Used for private pharmacy dashboard/profile access.
 * @param {string} ownerId - Owner User ID
 * @returns {Promise<Object|null>} Pharmacy or null if not found
 */
const getPharmacyByOwnerIdAnyStatus = async (ownerId) => {
  const pharmacy = await Pharmacy.findOne({ ownerId })
    .populate('ownerId', 'fullName email phone profileImage role status');

  if (!pharmacy) {
    return null;
  }

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
    .populate('ownerId', 'fullName email phone profileImage role status');
  
  if (!pharmacy) {
    throw new Error('Pharmacy not found');
  }

  // Public-facing invariant: only active pharmacies owned by APPROVED PHARMACY users
  // (Admins can still read via other endpoints if needed)
  if (!pharmacy.isActive) {
    throw new Error('Pharmacy not found');
  }

  const owner = pharmacy.ownerId;
  const ownerRole = typeof owner === 'object' ? owner.role : null;
  const ownerStatus = typeof owner === 'object' ? owner.status : null;
  if (ownerRole !== 'PHARMACY' || ownerStatus !== 'APPROVED') {
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
    .populate('ownerId', 'fullName email phone profileImage role status');

  if (!pharmacy) {
    return null;
  }

  const owner = pharmacy.ownerId;
  const ownerRole = typeof owner === 'object' ? owner.role : null;
  const ownerStatus = typeof owner === 'object' ? owner.status : null;
  if (ownerRole !== 'PHARMACY' || ownerStatus !== 'APPROVED') {
    return null;
  }
  
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

  // Only pharmacies owned by APPROVED PHARMACY users are visible publicly.
  // Apply this constraint even when filters are used.
  const approvedPharmacyUsers = await User.find({ role: 'PHARMACY', status: 'APPROVED' }).select('_id');
  const approvedPharmacyUserIds = approvedPharmacyUsers.map(u => u._id);
  query.ownerId = { $in: approvedPharmacyUserIds };

  if (ownerId) {
    // Handle both single ownerId and $in operator for multiple ownerIds
    if (typeof ownerId === 'object' && ownerId.$in) {
      query.ownerId = { $in: ownerId.$in.filter(id => approvedPharmacyUserIds.some(aid => aid.toString() === id.toString())) };
    } else {
      const isApprovedOwner = approvedPharmacyUserIds.some(id => id.toString() === ownerId.toString());
      if (!isApprovedOwner) {
        return {
          pharmacies: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0
          }
        };
      }
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
 * List pharmacies for admin panel (includes all owner statuses)
 * @param {Object} filter - Filter criteria
 * @returns {Promise<Object>} Pharmacies and pagination info
 */
const listPharmaciesAdmin = async (filter = {}) => {
  const {
    ownerId,
    city,
    search,
    page = 1,
    limit = 10
  } = filter;

  const query = {};

  if (ownerId) {
    query.ownerId = ownerId;
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
      .populate('ownerId', 'fullName email phone profileImage role status')
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
  getPharmacyByOwnerIdAnyStatus,
  listPharmacies,
  listPharmaciesAdmin,
  deletePharmacy
};

