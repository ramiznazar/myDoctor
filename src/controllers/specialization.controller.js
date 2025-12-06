const asyncHandler = require('../middleware/asyncHandler');
const specializationService = require('../services/specialization.service');

/**
 * Create specialization
 */
exports.create = asyncHandler(async (req, res) => {
  const result = await specializationService.createSpecialization(req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update specialization
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await specializationService.updateSpecialization(req.params.id, req.body);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List all specializations
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await specializationService.listSpecializations();
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Delete specialization
 */
exports.delete = asyncHandler(async (req, res) => {
  const result = await specializationService.deleteSpecialization(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

