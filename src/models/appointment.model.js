const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  appointmentDate: {
    type: Date,
    default: null
  },
  appointmentTime: {
    type: String,
    default: null
  },
  bookingType: {
    type: String,
    enum: ["VISIT", "ONLINE"],
    default: null
  },
  status: {
    type: String,
    enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"],
    default: null
  },
  paymentStatus: {
    type: String,
    enum: ["UNPAID", "PAID", "REFUNDED"],
    default: null
  },
  paymentMethod: {
    type: String,
    default: null
  },
  appointmentNumber: {
    type: String,
    default: null
  },
  patientNotes: {
    type: String,
    default: null
  },
  clinicName: {
    type: String,
    default: null
  },
  videoCallLink: {
    type: String,
    default: null
  },
  videoSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "VideoSession",
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Appointment", appointmentSchema);
