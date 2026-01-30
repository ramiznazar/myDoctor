const asyncHandler = require('../middleware/asyncHandler');
const pharmacyService = require('../services/pharmacy.service');

/**
 * Create pharmacy
 * If pharmacy or admin creates pharmacy, automatically set ownerId to their userId
 */
exports.create = asyncHandler(async (req, res) => {
  let pharmacyData = { ...req.body };
  
  if (req.userRole === 'PHARMACY') {
    pharmacyData.ownerId = req.userId;
  } else if (req.userRole === 'ADMIN') {
    if (!pharmacyData.ownerId) {
      return res.status(400).json({
        success: false,
        message: 'ownerId is required when admin creates a pharmacy'
      });
    }
  }
  // If ownerId is explicitly provided in body, it will be overridden by the above logic
  
  const result = await pharmacyService.createPharmacy(pharmacyData);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get my pharmacy profile (for pharmacy user)
 */
exports.getMyPharmacy = asyncHandler(async (req, res) => {
  const result = await pharmacyService.getPharmacyByOwnerIdAnyStatus(req.userId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update pharmacy
 * Admin can update any pharmacy, Pharmacy can only update their own pharmacy
 */
exports.update = asyncHandler(async (req, res) => {
  // If user is a pharmacy (not admin), verify they own this pharmacy
  if (req.userRole === 'PHARMACY') {
    // Get pharmacy without populating to check ownerId directly
    const Pharmacy = require('../models/pharmacy.model');
    const pharmacy = await Pharmacy.findById(req.params.id);
    
    if (!pharmacy) {
      return res.status(404).json({ success: false, message: 'Pharmacy not found' });
    }
    // Check if the pharmacy owns this pharmacy
    // ownerId is stored as ObjectId, so compare as strings
    if (pharmacy.ownerId.toString() !== req.userId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Unauthorized: You can only update your own pharmacy' 
      });
    }
  }
  
  const result = await pharmacyService.updatePharmacy(req.params.id, req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get pharmacy by ID
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await pharmacyService.getPharmacy(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List pharmacies with filtering
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await pharmacyService.listPharmacies(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Delete pharmacy
 */
exports.delete = asyncHandler(async (req, res) => {
  const result = await pharmacyService.deletePharmacy(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

