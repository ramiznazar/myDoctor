const asyncHandler = require('../middleware/asyncHandler');
const patientService = require('../services/patient.service');

/**
 * Get patient dashboard statistics
 */
exports.getDashboard = asyncHandler(async (req, res) => {
  const result = await patientService.getPatientDashboard(req.userId);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get patient appointment history
 */
exports.getAppointmentHistory = asyncHandler(async (req, res) => {
  const result = await patientService.getAppointmentHistory(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get patient payment history
 */
exports.getPaymentHistory = asyncHandler(async (req, res) => {
  const result = await patientService.getPaymentHistory(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Create medical record
 */
exports.createMedicalRecord = asyncHandler(async (req, res) => {
  const result = await patientService.createMedicalRecord(req.userId, req.body);
  res.json({ success: true, message: 'Medical record created successfully', data: result });
});

/**
 * Get patient medical records
 */
exports.getMedicalRecords = asyncHandler(async (req, res) => {
  const result = await patientService.getMedicalRecords(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Delete medical record
 */
exports.deleteMedicalRecord = asyncHandler(async (req, res) => {
  const result = await patientService.deleteMedicalRecord(req.params.id, req.userId);
  res.json({ success: true, message: 'Medical record deleted successfully', data: result });
});














