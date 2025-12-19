const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: null
  },
  recordType: {
    type: String,
    enum: ['PRESCRIPTION', 'LAB_REPORT', 'TEST_RESULT', 'IMAGE', 'PDF', 'OTHER'],
    default: 'OTHER'
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    default: null
  },
  fileSize: {
    type: Number,
    default: null
  },
  uploadedDate: {
    type: Date,
    default: Date.now
  },
  relatedAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    default: null
  },
  relatedDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);














