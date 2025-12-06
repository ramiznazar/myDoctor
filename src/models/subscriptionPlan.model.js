const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ["BASIC", "MEDIUM", "FULL"],
    default: null
  },
  price: {
    type: Number,
    default: null
  },
  durationInDays: {
    type: Number,
    default: null
  },
  features: {
    type: [String],
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
