const mongoose = require('mongoose');

const supportTicketMessageSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['PATIENT', 'ADMIN'], required: true },
  body: { type: String, default: null, trim: true, maxlength: 8000 },
  attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicketAttachment' }],
}, { timestamps: true });

supportTicketMessageSchema.index({ ticketId: 1, createdAt: 1 });
module.exports = mongoose.model('SupportTicketMessage', supportTicketMessageSchema);
