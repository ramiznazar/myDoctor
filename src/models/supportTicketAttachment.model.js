const mongoose = require('mongoose');

const supportTicketAttachmentSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', default: null, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true, trim: true, maxlength: 255 },
  storedName: { type: String, required: true, trim: true, maxlength: 255 },
  mimeType: { type: String, required: true, trim: true, maxlength: 150 },
  size: { type: Number, required: true, min: 0 },
}, { timestamps: true });

supportTicketAttachmentSchema.index({ uploadedBy: 1, ticketId: 1, createdAt: -1 });
module.exports = mongoose.model('SupportTicketAttachment', supportTicketAttachmentSchema);
