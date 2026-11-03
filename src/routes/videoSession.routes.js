const express = require('express');
const router = express.Router();
const videoSessionController = require('../controllers/videoSession.controller');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');
const { z } = require('zod');

// Validators for video session
const startSessionValidator = z.object({
  body: z.object({
    appointmentId: z.string().min(1, 'Appointment ID is required')
  })
});

const sessionIdValidator = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'Session ID is required')
  })
});

/**
 * @route   POST /api/video/start
 * @desc    Start (ring) a video call for a confirmed online appointment
 * @access  Private (Doctor or Patient)
 */
router.post(
  '/start',
  authGuard(['DOCTOR', 'PATIENT']),
  validate(startSessionValidator),
  asyncHandler(videoSessionController.startSession)
);

/**
 * @route   POST /api/video/accept
 * @desc    Accept an incoming ringing call
 * @access  Private (Doctor or Patient)
 */
router.post(
  '/accept',
  authGuard(['DOCTOR', 'PATIENT']),
  validate(sessionIdValidator),
  asyncHandler(videoSessionController.acceptSession)
);

/**
 * @route   POST /api/video/end
 * @desc    End or decline a video call (idempotent)
 * @access  Private (Doctor or Patient)
 */
router.post(
  '/end',
  authGuard(['DOCTOR', 'PATIENT']),
  validate(sessionIdValidator),
  asyncHandler(videoSessionController.endSession)
);

/**
 * @route   GET /api/video/incoming
 * @desc    List calls currently ringing for the authenticated user
 * @access  Private (Doctor or Patient)
 */
router.get(
  '/incoming',
  authGuard(['DOCTOR', 'PATIENT']),
  asyncHandler(videoSessionController.getIncoming)
);

/**
 * @route   GET /api/video/by-appointment/:appointmentId
 * @desc    Get session by appointment ID with a fresh token
 * @access  Private (Doctor or Patient)
 */
router.get(
  '/by-appointment/:appointmentId',
  authGuard(['DOCTOR', 'PATIENT']),
  asyncHandler(videoSessionController.getByAppointment)
);

module.exports = router;
