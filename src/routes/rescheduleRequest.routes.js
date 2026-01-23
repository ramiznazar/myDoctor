const express = require('express');
const router = express.Router();
const rescheduleRequestController = require('../controllers/rescheduleRequest.controller');
const {
  createRescheduleRequestValidator,
  approveRescheduleRequestValidator,
  rejectRescheduleRequestValidator,
  payRescheduleFeeValidator
} = require('../validators/rescheduleRequest.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   GET /api/reschedule-request/eligible-appointments
 * @desc    Get appointments eligible for reschedule (patient only)
 * @access  Private (Patient)
 */
router.get(
  '/eligible-appointments',
  authGuard(['PATIENT']),
  asyncHandler(rescheduleRequestController.getEligibleAppointments)
);

/**
 * @route   POST /api/reschedule-request
 * @desc    Create reschedule request (patient only)
 * @access  Private (Patient)
 */
router.post(
  '/',
  authGuard(['PATIENT']),
  validate(createRescheduleRequestValidator),
  asyncHandler(rescheduleRequestController.create)
);

/**
 * @route   GET /api/reschedule-request
 * @desc    List reschedule requests (filtered by role)
 *         - Patients: see their own requests
 *         - Doctors: see requests for their appointments
 *         - Admin: see all requests
 * @access  Private
 */
router.get(
  '/',
  authGuard([]),
  asyncHandler(rescheduleRequestController.list)
);

/**
 * @route   GET /api/reschedule-request/:id
 * @desc    Get reschedule request by ID
 * @access  Private
 */
router.get(
  '/:id',
  authGuard([]),
  asyncHandler(rescheduleRequestController.getById)
);

/**
 * @route   POST /api/reschedule-request/:id/approve
 * @desc    Approve reschedule request (doctor only)
 * @access  Private (Doctor)
 */
router.post(
  '/:id/approve',
  authGuard(['DOCTOR']),
  validate(approveRescheduleRequestValidator),
  asyncHandler(rescheduleRequestController.approve)
);

/**
 * @route   POST /api/reschedule-request/:id/reject
 * @desc    Reject reschedule request (doctor only)
 * @access  Private (Doctor)
 */
router.post(
  '/:id/reject',
  authGuard(['DOCTOR']),
  validate(rejectRescheduleRequestValidator),
  asyncHandler(rescheduleRequestController.reject)
);

/**
 * @route   POST /api/reschedule-request/:id/pay
 * @desc    Pay reschedule fee (patient only)
 * @access  Private (Patient)
 */
router.post(
  '/:id/pay',
  authGuard(['PATIENT']),
  validate(payRescheduleFeeValidator),
  asyncHandler(rescheduleRequestController.pay)
);

module.exports = router;
