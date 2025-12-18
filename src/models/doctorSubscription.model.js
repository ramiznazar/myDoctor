const mongoose = require('mongoose');

const doctorSubscriptionSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionPlan',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
    default: 'ACTIVE'
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  }
}, { timestamps: true });

// Index for efficient queries
doctorSubscriptionSchema.index({ doctorId: 1, status: 1 });
doctorSubscriptionSchema.index({ endDate: 1 });

module.exports = mongoose.model('DoctorSubscription', doctorSubscriptionSchema);












