const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  strength: { type: String, default: null },
  form: { type: String, default: null },
  route: { type: String, default: null },
  dosage: { type: String, default: null },
  frequency: { type: String, default: null },
  duration: { type: String, default: null },
  quantity: { type: String, default: null },
  refills: { type: Number, default: 0, min: 0 },
  instructions: { type: String, default: null },
  substitutionAllowed: { type: Boolean, default: true },
  isPrn: { type: Boolean, default: false }
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    required: true,
    unique: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  diagnosis: {
    type: String,
    default: null
  },
  clinicalNotes: {
    type: String,
    default: null
  },
  allergies: {
    type: String,
    default: null
  },
  medications: {
    type: [medicationSchema],
    default: []
  },
  tests: {
    type: [String],
    default: []
  },
  advice: {
    type: String,
    default: null
  },
  followUp: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['DRAFT', 'ISSUED'],
    default: 'ISSUED'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Prescription', prescriptionSchema);
