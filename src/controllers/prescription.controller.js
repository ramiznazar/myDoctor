const asyncHandler = require('../middleware/asyncHandler');
const prescriptionService = require('../services/prescription.service');

exports.upsertForAppointment = asyncHandler(async (req, res) => {
  const result = await prescriptionService.upsertPrescriptionForAppointment(
    req.userId,
    req.params.appointmentId,
    req.body
  );
  res.json({ success: true, message: 'OK', data: result });
});

exports.getByAppointment = asyncHandler(async (req, res) => {
  const result = await prescriptionService.getPrescriptionByAppointment(
    req.params.appointmentId,
    req.userId,
    req.userRole
  );
  res.json({ success: true, message: 'OK', data: result });
});

exports.getById = asyncHandler(async (req, res) => {
  const result = await prescriptionService.getPrescriptionById(
    req.params.id,
    req.userId,
    req.userRole
  );
  res.json({ success: true, message: 'OK', data: result });
});

exports.listMine = asyncHandler(async (req, res) => {
  if (req.userRole !== 'PATIENT') {
    const error = new Error('Insufficient permissions');
    error.statusCode = 403;
    throw error;
  }

  const result = await prescriptionService.listPrescriptionsForPatient(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});
