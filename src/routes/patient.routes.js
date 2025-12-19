const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/patient/dashboard
 * @desc    Get patient dashboard statistics
 * @access  Private (Patient)
 */
router.get(
  '/dashboard',
  authGuard(['PATIENT']),
  asyncHandler(patientController.getDashboard)
);

/**
 * @route   GET /api/patient/appointments/history
 * @desc    Get patient appointment history
 * @access  Private (Patient)
 */
router.get(
  '/appointments/history',
  authGuard(['PATIENT']),
  asyncHandler(patientController.getAppointmentHistory)
);

/**
 * @route   GET /api/patient/payments/history
 * @desc    Get patient payment history
 * @access  Private (Patient)
 */
router.get(
  '/payments/history',
  authGuard(['PATIENT']),
  asyncHandler(patientController.getPaymentHistory)
);

/**
 * @route   POST /api/patient/medical-records
 * @desc    Create medical record
 * @access  Private (Patient)
 */
router.post(
  '/medical-records',
  authGuard(['PATIENT']),
  asyncHandler(patientController.createMedicalRecord)
);

/**
 * @route   GET /api/patient/medical-records
 * @desc    Get patient medical records
 * @access  Private (Patient)
 */
router.get(
  '/medical-records',
  authGuard(['PATIENT']),
  asyncHandler(patientController.getMedicalRecords)
);

/**
 * @route   DELETE /api/patient/medical-records/:id
 * @desc    Delete medical record
 * @access  Private (Patient)
 */
router.delete(
  '/medical-records/:id',
  authGuard(['PATIENT']),
  asyncHandler(patientController.deleteMedicalRecord)
);

module.exports = router;














