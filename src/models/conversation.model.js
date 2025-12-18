const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
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
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    default: null // Optional: required only for doctor-patient conversations
  },
  conversationType: {
    type: String,
    enum: ["DOCTOR_PATIENT", "ADMIN_DOCTOR"],
    default: "DOCTOR_PATIENT"
  },
  lastMessageAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Conversation", conversationSchema);
