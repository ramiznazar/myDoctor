const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/announcements
 * @desc    Create announcement
 * @access  Private (Admin only)
 */
router.post(
  '/',
  authGuard(['ADMIN']),
  asyncHandler(announcementController.create)
);

/**
 * @route   GET /api/announcements
 * @desc    List announcements (admin)
 * @access  Private (Admin only)
 */
router.get(
  '/',
  authGuard(['ADMIN']),
  asyncHandler(announcementController.list)
);

/**
 * @route   GET /api/announcements/doctor
 * @desc    Get announcements for doctor
 * @access  Private (Doctor only)
 */
router.get(
  '/doctor',
  authGuard(['DOCTOR']),
  asyncHandler(announcementController.getForDoctor)
);

/**
 * @route   GET /api/announcements/unread-count
 * @desc    Get unread announcement count for doctor
 * @access  Private (Doctor only)
 */
router.get(
  '/unread-count',
  authGuard(['DOCTOR']),
  asyncHandler(announcementController.getUnreadCount)
);

/**
 * @route   GET /api/announcements/:id
 * @desc    Get single announcement
 * @access  Private
 */
router.get(
  '/:id',
  authGuard(['ADMIN', 'DOCTOR']),
  asyncHandler(announcementController.getById)
);

/**
 * @route   PUT /api/announcements/:id
 * @desc    Update announcement
 * @access  Private (Admin only)
 */
router.put(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(announcementController.update)
);

/**
 * @route   DELETE /api/announcements/:id
 * @desc    Delete announcement
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authGuard(['ADMIN']),
  asyncHandler(announcementController.delete)
);

/**
 * @route   POST /api/announcements/:id/read
 * @desc    Mark announcement as read
 * @access  Private (Doctor only)
 */
router.post(
  '/:id/read',
  authGuard(['DOCTOR']),
  asyncHandler(announcementController.markAsRead)
);

/**
 * @route   GET /api/announcements/:id/read-status
 * @desc    Get announcement read status (who has read it)
 * @access  Private (Admin only)
 */
router.get(
  '/:id/read-status',
  authGuard(['ADMIN']),
  asyncHandler(announcementController.getReadStatus)
);

module.exports = router;







