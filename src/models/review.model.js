const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
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
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    default: null
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  reviewText: {
    type: String,
    default: null
  },
  reviewType: {
    type: String,
    enum: ["OVERALL", "APPOINTMENT"],
    default: "OVERALL"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Review", reviewSchema);
