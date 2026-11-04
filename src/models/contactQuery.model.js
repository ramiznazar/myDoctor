const mongoose = require('mongoose');

const contactQuerySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, trim: true, maxlength: 80, default: '' },
  services: { type: String, trim: true, maxlength: 160, default: '' },
  message: { type: String, required: true, trim: true, minlength: 10, maxlength: 5000 },
  status: { type: String, enum: ['NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], default: 'NEW', index: true },
  adminNotes: { type: String, trim: true, maxlength: 5000, default: '' },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

contactQuerySchema.index({ status: 1, createdAt: -1 });
contactQuerySchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('ContactQuery', contactQuerySchema);
