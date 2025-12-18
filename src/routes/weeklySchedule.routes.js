const express = require('express');
const router = express.Router();
const weeklyScheduleController = require('../controllers/weeklySchedule.controller');
const {
  upsertWeeklyScheduleValidator,
  addTimeSlotValidator,
  updateTimeSlotValidator,
  updateAppointmentDurationValidator,
  getAvailableSlotsValidator
} = require('../validators/weeklySchedule.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/weekly-schedule
 * @desc    Create or update weekly schedule
 * @access  Private (Doctor)
 */
router.post(
  '/',
  authGuard(['DOCTOR']),
  validate(upsertWeeklyScheduleValidator),
  asyncHandler(weeklyScheduleController.upsertSchedule)
);

/**
 * @route   GET /api/weekly-schedule
 * @desc    Get weekly schedule
 * @access  Private (Doctor)
 */
router.get(
  '/',
  authGuard(['DOCTOR']),
  asyncHandler(weeklyScheduleController.getSchedule)
);

/**
 * @route   PUT /api/weekly-schedule/duration
 * @desc    Update appointment duration
 * @access  Private (Doctor)
 */
router.put(
  '/duration',
  authGuard(['DOCTOR']),
  validate(updateAppointmentDurationValidator),
  asyncHandler(weeklyScheduleController.updateAppointmentDuration)
);

/**
 * @route   POST /api/weekly-schedule/day/:dayOfWeek/slot
 * @desc    Add time slot to a day
 * @access  Private (Doctor)
 */
router.post(
  '/day/:dayOfWeek/slot',
  authGuard(['DOCTOR']),
  validate(addTimeSlotValidator),
  asyncHandler(weeklyScheduleController.addTimeSlot)
);

/**
 * @route   PUT /api/weekly-schedule/day/:dayOfWeek/slot/:slotId
 * @desc    Update time slot
 * @access  Private (Doctor)
 */
router.put(
  '/day/:dayOfWeek/slot/:slotId',
  authGuard(['DOCTOR']),
  validate(updateTimeSlotValidator),
  asyncHandler(weeklyScheduleController.updateTimeSlot)
);

/**
 * @route   DELETE /api/weekly-schedule/day/:dayOfWeek/slot/:slotId
 * @desc    Delete time slot
 * @access  Private (Doctor)
 */
router.delete(
  '/day/:dayOfWeek/slot/:slotId',
  authGuard(['DOCTOR']),
  asyncHandler(weeklyScheduleController.deleteTimeSlot)
);

/**
 * @route   GET /api/weekly-schedule/slots
 * @desc    Get available slots for a date (public)
 * @access  Public
 */
router.get(
  '/slots',
  validate(getAvailableSlotsValidator),
  asyncHandler(weeklyScheduleController.getAvailableSlotsForDate)
);

module.exports = router;


