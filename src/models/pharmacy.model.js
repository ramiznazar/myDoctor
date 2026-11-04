const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  kind: {
    type: String,
    enum: ['PHARMACY', 'PARAPHARMACY'],
    default: 'PHARMACY'
  },
  name: {
    type: String,
    default: null
  },
  logo: {
    type: String,
    default: null
  },
  address: {
    line1: { type: String, default: null },
    line2: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    zip: { type: String, default: null }
  },
  phone: {
    type: String,
    default: null
  },
  location: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Pharmacy", pharmacySchema);
