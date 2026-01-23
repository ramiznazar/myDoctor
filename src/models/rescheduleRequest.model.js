const mongoose = require('mongoose');

const rescheduleRequestSchema = new mongoose.Schema({
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    required: true
  },
  originalAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  reason: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 500
  },
  preferredDate: {
    type: Date,
    default: null
  },
  preferredTime: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
    default: "PENDING"
  },
  rescheduleFee: {
    type: Number,
    default: null
  },
  rescheduleFeePercentage: {
    type: Number,
    default: 50
  },
  originalAppointmentFee: {
    type: Number,
    required: true
  },
  doctorNotes: {
    type: String,
    default: null,
    maxlength: 500
  },
  rejectionReason: {
    type: String,
    default: null,
    maxlength: 500
  },
  newAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    default: null
  },
  paymentTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    default: null
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
rescheduleRequestSchema.index({ appointmentId: 1 });
rescheduleRequestSchema.index({ patientId: 1 });
rescheduleRequestSchema.index({ doctorId: 1 });
rescheduleRequestSchema.index({ status: 1 });

module.exports = mongoose.model("RescheduleRequest", rescheduleRequestSchema);
