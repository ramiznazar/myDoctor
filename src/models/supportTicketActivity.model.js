const mongoose = require('mongoose');

const supportTicketActivitySchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, enum: ['CREATED', 'PATIENT_REPLIED', 'ADMIN_REPLIED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'ASSIGNED', 'REOPENED', 'ATTACHMENTS_ADDED'], required: true },
  summary: { type: String, required: true, trim: true, maxlength: 500 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

supportTicketActivitySchema.index({ ticketId: 1, createdAt: 1 });
module.exports = mongoose.model('SupportTicketActivity', supportTicketActivitySchema);
