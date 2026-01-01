const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  relatedAppointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    default: null
  },
  relatedSubscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubscriptionPlan",
    default: null
  },
  relatedProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    default: null
  },
  relatedOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    default: null
  },
  amount: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
    default: null
  },
  provider: {
    type: String,
    default: null
  },
  providerReference: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Transaction", transactionSchema);
