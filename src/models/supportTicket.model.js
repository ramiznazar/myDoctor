const mongoose = require('mongoose');

const SUPPORT_TICKET_CATEGORIES = ['APPOINTMENT', 'RESCHEDULE', 'VIDEO_CALL', 'PAYMENT', 'PHARMACY_ORDER', 'PARAPHARMACY_ORDER', 'DELIVERY', 'REFUND', 'PRESCRIPTION', 'ACCOUNT_REGISTRATION', 'DOCTOR', 'TECHNICAL', 'OTHER'];
const SUPPORT_TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_PATIENT', 'RESOLVED', 'CLOSED'];
const SUPPORT_TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const SUPPORT_RELATED_RECORD_TYPES = ['APPOINTMENT', 'ORDER', 'TRANSACTION', 'PRESCRIPTION', 'OTHER'];

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, unique: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subject: { type: String, required: true, trim: true, minlength: 4, maxlength: 180 },
  category: { type: String, enum: SUPPORT_TICKET_CATEGORIES, required: true, index: true },
  priority: { type: String, enum: SUPPORT_TICKET_PRIORITIES, default: 'MEDIUM', index: true },
  status: { type: String, enum: SUPPORT_TICKET_STATUSES, default: 'OPEN', index: true },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 8000 },
  relatedRecord: {
    type: { type: String, enum: SUPPORT_RELATED_RECORD_TYPES, default: null },
    recordId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  assignedAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  unreadForPatient: { type: Boolean, default: false },
  unreadForAdmin: { type: Boolean, default: true },
  resolvedAt: { type: Date, default: null },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

supportTicketSchema.index({ patientId: 1, updatedAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, updatedAt: -1 });

supportTicketSchema.statics.createTicketNumber = async function createTicketNumber() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ticketNumber = `SUP-${day}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    // The unique index is the concurrency safeguard; this makes collisions friendlier.
    // eslint-disable-next-line no-await-in-loop
    if (!await this.exists({ ticketNumber })) return ticketNumber;
  }
  return `SUP-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
module.exports.SUPPORT_TICKET_CATEGORIES = SUPPORT_TICKET_CATEGORIES;
module.exports.SUPPORT_TICKET_STATUSES = SUPPORT_TICKET_STATUSES;
module.exports.SUPPORT_TICKET_PRIORITIES = SUPPORT_TICKET_PRIORITIES;
module.exports.SUPPORT_RELATED_RECORD_TYPES = SUPPORT_RELATED_RECORD_TYPES;
