const mongoose = require('mongoose');

// Durable outbox for transactional email.  A stable dedupe key prevents
// scheduler retries and repeated status updates from sending the same email
// twice, while retaining enough information to investigate a failed delivery.
const emailNotificationSchema = new mongoose.Schema({
  dedupeKey: { type: String, unique: true, sparse: true, trim: true },
  type: { type: String, required: true, trim: true },
  recipient: { type: String, required: true, lowercase: true, trim: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  html: { type: String, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'],
    default: 'PENDING',
    index: true,
  },
  attempts: { type: Number, default: 0, min: 0 },
  maxAttempts: { type: Number, default: 5, min: 1 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  lastAttemptAt: { type: Date, default: null },
  lastError: { type: String, default: null },
  messageId: { type: String, default: null },
  sentAt: { type: Date, default: null },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

emailNotificationSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('EmailNotification', emailNotificationSchema);
