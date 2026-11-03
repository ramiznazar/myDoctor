const mongoose = require('mongoose');

const productPrescriptionRequestSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true },
  pharmacyOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  prescriptionUrl: { type: String, required: true },
  originalName: { type: String, default: null },
  mimeType: { type: String, default: null },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  reviewNotes: { type: String, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
}, { timestamps: true });

productPrescriptionRequestSchema.index({ patientId: 1, productId: 1, variantId: 1, status: 1, createdAt: -1 });
productPrescriptionRequestSchema.index({ pharmacyOwnerId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('ProductPrescriptionRequest', productPrescriptionRequestSchema);
