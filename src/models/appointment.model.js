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
  appointmentDuration: {
    type: Number,
    default: 30, // Default 30 minutes
    min: 15,
    max: 120
  },
  appointmentEndTime: {
    type: String,
    default: null // Calculated from appointmentTime + duration
  },
  timezone: {
    type: String,
    default: null // User's timezone (e.g., "Asia/Karachi", "UTC+5", "America/New_York")
  },
  timezoneOffset: {
    type: Number,
    default: null // Timezone offset in minutes (e.g., 300 for UTC+5)
  },
  bookingType: {
    type: String,
    enum: ["VISIT", "ONLINE"],
    default: null
  },
  status: {
    type: String,
    enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW", "REJECTED", "RESCHEDULED", "PENDING_PAYMENT"],
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
  },
  notes: {
    type: String,
    default: null
  },
  rescheduleRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "RescheduleRequest",
    default: null
  },
  isRescheduled: {
    type: Boolean,
    default: false
  },
  originalAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    default: null
  },
  rescheduleFee: {
    type: Number,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Appointment", appointmentSchema);
