const express = require('express');
const router = express.Router();
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');
const validate = require('../middleware/validate');
const prescriptionController = require('../controllers/prescription.controller');
const prescriptionService = require('../services/prescription.service');
const { streamPrescriptionPdf } = require('../services/prescriptionPdf.service');
const {
  upsertPrescriptionForAppointmentValidator,
  appointmentIdParamValidator,
  prescriptionIdParamValidator,
  listPrescriptionsValidator
} = require('../validators/prescription.validators');

router.post(
  '/appointment/:appointmentId',
  authGuard(['DOCTOR']),
  validate(upsertPrescriptionForAppointmentValidator),
  asyncHandler(prescriptionController.upsertForAppointment)
);

router.get(
  '/appointment/:appointmentId',
  authGuard(['DOCTOR', 'PATIENT']),
  validate(appointmentIdParamValidator),
  asyncHandler(prescriptionController.getByAppointment)
);

router.get(
  '/',
  authGuard(['PATIENT']),
  validate(listPrescriptionsValidator),
  asyncHandler(prescriptionController.listMine)
);

router.get(
  '/:id',
  authGuard(['DOCTOR', 'PATIENT']),
  validate(prescriptionIdParamValidator),
  asyncHandler(prescriptionController.getById)
);

router.get(
  '/:id/pdf',
  authGuard(['DOCTOR', 'PATIENT']),
  validate(prescriptionIdParamValidator),
  asyncHandler(async (req, res) => {
    const prescription = await prescriptionService.getPrescriptionById(req.params.id, req.userId, req.userRole);
    streamPrescriptionPdf({ res, prescription });
  })
);

module.exports = router;
