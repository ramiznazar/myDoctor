const asyncHandler = require('../middleware/asyncHandler');
const announcementService = require('../services/announcement.service');

/**
 * Create announcement
 */
exports.create = asyncHandler(async (req, res) => {
  const announcementData = {
    ...req.body,
    createdBy: req.userId
  };
  const result = await announcementService.createAnnouncement(announcementData);
  res.json({ success: true, message: 'Announcement created successfully', data: result });
});

/**
 * List announcements (admin)
 */
exports.list = asyncHandler(async (req, res) => {
  const result = await announcementService.listAnnouncements(req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get announcements for doctor
 */
exports.getForDoctor = asyncHandler(async (req, res) => {
  const result = await announcementService.getAnnouncementsForDoctor(req.userId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get single announcement
 */
exports.getById = asyncHandler(async (req, res) => {
  const result = await announcementService.getAnnouncementById(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Update announcement
 */
exports.update = asyncHandler(async (req, res) => {
  const result = await announcementService.updateAnnouncement(req.params.id, req.body);
  res.json({ success: true, message: 'Announcement updated successfully', data: result });
});

/**
 * Delete announcement
 */
exports.delete = asyncHandler(async (req, res) => {
  const result = await announcementService.deleteAnnouncement(req.params.id);
  res.json({ success: true, message: result.message, data: result });
});

/**
 * Mark announcement as read
 */
exports.markAsRead = asyncHandler(async (req, res) => {
  const result = await announcementService.markAnnouncementAsRead(req.params.id, req.userId);
  res.json({ success: true, message: 'Announcement marked as read', data: result });
});

/**
 * Get announcement read status (who has read it)
 */
exports.getReadStatus = asyncHandler(async (req, res) => {
  const result = await announcementService.getAnnouncementReadStatus(req.params.id, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get unread announcement count for doctor
 */
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const result = await announcementService.getUnreadAnnouncementCount(req.userId);
  res.json({ success: true, message: 'OK', data: { unreadCount: result } });
});





