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
  // Present only while this appointment blocks a doctor slot.  Its partial
  // unique index closes the create-request race that a read-then-create
  // conflict check alone cannot prevent.
  activeSlotKey: {
    type: String,
    default: undefined
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
    default: null // Device-configured IANA timezone (for example, "America/New_York" or "UTC")
  },
  timezoneOffset: {
    type: Number,
    default: null // Minutes east of UTC; retained as a legacy fallback
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
  consultationFee: {
    type: Number,
    default: null
  },
  selectedServices: {
    type: [
      {
        name: { type: String, default: null },
        price: { type: Number, default: null }
      }
    ],
    default: []
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'EUR'
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

appointmentSchema.index({ doctorId: 1, appointmentDate: 1, status: 1 });
// Index only active slots.  A sparse unique index would still index explicit
// `null` values, so use a partial index and omit the key when the slot is
// released.
appointmentSchema.index(
  { activeSlotKey: 1 },
  {
    unique: true,
    partialFilterExpression: { activeSlotKey: { $type: 'string' } }
  }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
