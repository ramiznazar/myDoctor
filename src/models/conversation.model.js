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
  // A pharmacy or parapharmacy participant in an admin-support conversation.
  // Kept separate from doctorId to preserve the doctor/patient schema and
  // make role-specific permissions explicit.
  businessId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    default: null // Optional: required only for doctor-patient conversations
  },
  // A relationship has one chat but may span several appointments.  Keep all
  // links for audit/history while `appointmentId` remains the latest one for
  // existing clients.
  appointmentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment"
  }],
  conversationType: {
    type: String,
    enum: ["DOCTOR_PATIENT", "ADMIN_DOCTOR", "ADMIN_PHARMACY", "ADMIN_PARAPHARMACY"],
    default: "DOCTOR_PATIENT"
  },
  status: {
    type: String,
    enum: ["ACTIVE", "COMPLETED"],
    default: "ACTIVE"
  },
  completedAt: {
    type: Date,
    default: null
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  // Older appointment-specific records are soft-merged into the canonical
  // doctor-patient conversation so the chat list has no duplicate rows.
  mergedInto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    default: null
  },
  // One canonical doctor-patient history exists for a relationship.  This
  // sparse key makes that invariant safe even when both users open chat at
  // the same time in separate browser sessions.
  relationshipKey: {
    type: String,
    default: undefined
  },
  lastMessage: {
    message: { type: String, default: null },
    sentAt: { type: Date, default: null },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  lastMessageAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

conversationSchema.index({ doctorId: 1, patientId: 1, conversationType: 1, mergedInto: 1 });
conversationSchema.index({ adminId: 1, businessId: 1, conversationType: 1 });
conversationSchema.index({ patientId: 1, lastMessageAt: -1 });
conversationSchema.index({ doctorId: 1, lastMessageAt: -1 });
conversationSchema.index(
  { relationshipKey: 1 },
  {
    unique: true,
    partialFilterExpression: { relationshipKey: { $type: 'string' } }
  }
);

module.exports = mongoose.model("Conversation", conversationSchema);
