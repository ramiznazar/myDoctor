const mongoose = require('mongoose');

const withdrawalRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED", "COMPLETED"],
    default: "PENDING"
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  paymentMethod: {
    type: String,
    default: null
  },
  paymentDetails: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);

