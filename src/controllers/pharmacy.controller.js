const asyncHandler = require('../middleware/asyncHandler');
const pharmacyService = require('../services/pharmacy.service');

/**
 * Create pharmacy
 */
exports.create = asyncHandler(async (req, res) => {
  const result = await pharmacyService.createPharmacy(req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update pharmacy
 */
exports.update = asyncHandler(async (req, res) => {
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

