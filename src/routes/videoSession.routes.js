const express = require('express');
const router = express.Router();
const videoSessionController = require('../controllers/videoSession.controller');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');
const { requireAppointmentAccess, requireConfirmedAppointment } = require('../middleware/appointmentAccess');
const { z } = require('zod');

// Validators for video session
const startSessionValidator = z.object({
  body: z.object({
    appointmentId: z.string().min(1, 'Appointment ID is required')
  })
});

const endSessionValidator = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'Session ID is required')
  })
});

/**
 * @route   POST /api/video/start
 * @desc    Start video session (requires confirmed appointment and appointment time must have started)
 * @access  Private (Doctor or Patient)
 */
router.post(
  '/start',
  authGuard(['DOCTOR', 'PATIENT']),
  validate(startSessionValidator),
  requireAppointmentAccess,
  asyncHandler(videoSessionController.startSession)
);

/**
 * @route   POST /api/video/end
 * @desc    End video session
 * @access  Private (Doctor)
 */
router.post(
  '/end',
  authGuard(['DOCTOR']),
  validate(endSessionValidator),
  asyncHandler(videoSessionController.endSession)
);

/**
 * @route   GET /api/video/by-appointment/:appointmentId
 * @desc    Get session by appointment ID (requires confirmed appointment)
 * @access  Private
 */
router.get(
  '/by-appointment/:appointmentId',
  authGuard([]),
  requireConfirmedAppointment,
  asyncHandler(videoSessionController.getByAppointment)
);

module.exports = router;

