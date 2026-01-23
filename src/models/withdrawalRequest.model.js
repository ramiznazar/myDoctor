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
  },
  // Withdrawal Fee Fields
  withdrawalFeePercent: {
    type: Number,
    default: null, // Set by admin when approving
    min: 0,
    max: 100 // Percentage (0-100)
  },
  withdrawalFeeAmount: {
    type: Number,
    default: null, // Calculated: amount * (withdrawalFeePercent / 100)
    min: 0
  },
  totalDeducted: {
    type: Number,
    default: null, // Calculated: amount + withdrawalFeeAmount
    min: 0
  },
  netAmount: {
    type: Number,
    default: null, // Same as amount (what doctor receives)
    min: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);

