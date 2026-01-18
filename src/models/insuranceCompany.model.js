const mongoose = require('mongoose');

const insuranceCompanySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  logo: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
insuranceCompanySchema.index({ isActive: 1, createdAt: -1 });
insuranceCompanySchema.index({ name: 1 });

module.exports = mongoose.model("InsuranceCompany", insuranceCompanySchema);
