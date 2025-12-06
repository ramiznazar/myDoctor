const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const {
  createAppointmentValidator,
  updateAppointmentStatusValidator,
  filterAppointmentsValidator
} = require('../validators/appointment.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/appointment
 * @desc    Create appointment
 * @access  Private
 */
router.post(
  '/',
  authGuard([]),
  validate(createAppointmentValidator),
  asyncHandler(appointmentController.create)
);

/**
 * @route   PUT /api/appointment/:id/status
 * @desc    Update appointment status
 * @access  Private
 */
router.put(
  '/:id/status',
  authGuard([]),
  validate(updateAppointmentStatusValidator),
  asyncHandler(appointmentController.updateStatus)
);

/**
 * @route   GET /api/appointment
 * @desc    List appointments with filtering
 * @access  Private
 */
router.get(
  '/',
  authGuard([]),
  validate(filterAppointmentsValidator),
  asyncHandler(appointmentController.list)
);

/**
 * @route   GET /api/appointment/:id
 * @desc    Get appointment by ID
 * @access  Private
 */
router.get(
  '/:id',
  authGuard([]),
  asyncHandler(appointmentController.getById)
);

module.exports = router;

