const path = require('path');
const asyncHandler = require('../middleware/asyncHandler');
const supportTickets = require('../services/supportTicket.service');

exports.uploadAttachments = asyncHandler(async (req, res) => {
  const attachments = await supportTickets.createAttachments(req.files, req.userId);
  res.status(201).json({ success: true, message: 'Attachments uploaded successfully', data: { attachments: attachments.map(supportTickets.attachmentDto) } });
});

exports.listMine = asyncHandler(async (req, res) => {
  const result = await supportTickets.listMine(req.userId, req.userRole, req.query);
  res.json({ success: true, message: 'OK', data: result });
});
exports.getMine = asyncHandler(async (req, res) => {
  const result = await supportTickets.getMine(req.params.ticketId, req.userId, req.userRole);
  res.json({ success: true, message: 'OK', data: result });
});
exports.create = asyncHandler(async (req, res) => {
  const result = await supportTickets.create(req.userId, req.userRole, req.body);
  res.status(201).json({ success: true, message: 'Support ticket created', data: result });
});
exports.reply = asyncHandler(async (req, res) => {
  const result = await supportTickets.addPatientMessage(req.params.ticketId, req.userId, req.userRole, req.body);
  res.status(201).json({ success: true, message: 'Reply sent', data: result });
});
exports.reopen = asyncHandler(async (req, res) => {
  const result = await supportTickets.reopen(req.params.ticketId, req.userId, req.userRole);
  res.json({ success: true, message: 'Support ticket reopened', data: result });
});
exports.getMineUnreadCount = asyncHandler(async (req, res) => {
  const result = await supportTickets.getMineUnreadCount(req.userId, req.userRole);
  res.json({ success: true, message: 'OK', data: result });
});

exports.listAdmin = asyncHandler(async (req, res) => {
  const result = await supportTickets.listAdmin(req.query);
  res.json({ success: true, message: 'OK', data: result });
});
exports.getAdmin = asyncHandler(async (req, res) => {
  const result = await supportTickets.getAdmin(req.params.ticketId);
  res.json({ success: true, message: 'OK', data: result });
});
exports.updateAdmin = asyncHandler(async (req, res) => {
  const result = await supportTickets.updateAdmin(req.params.ticketId, req.userId, req.body);
  res.json({ success: true, message: 'Support ticket updated', data: result });
});
exports.replyAdmin = asyncHandler(async (req, res) => {
  const result = await supportTickets.addAdminMessage(req.params.ticketId, req.userId, req.body);
  res.status(201).json({ success: true, message: 'Reply sent', data: result });
});
exports.getAdminUnreadCount = asyncHandler(async (req, res) => {
  const result = await supportTickets.getAdminUnreadCount();
  res.json({ success: true, message: 'OK', data: result });
});
exports.downloadAttachment = asyncHandler(async (req, res) => {
  const { attachment, filePath } = await supportTickets.attachmentFile(req.params.attachmentId, req.userId, req.userRole);
  const safeName = path.basename(attachment.originalName).replace(/[\r\n"]/g, '_');
  res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.sendFile(filePath);
});
