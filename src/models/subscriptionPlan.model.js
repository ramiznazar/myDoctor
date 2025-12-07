const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  durationInDays: {
    type: Number,
    required: true,
    min: 1
  },
  features: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ["ACTIVE", "INACTIVE"],
    default: "ACTIVE"
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("SubscriptionPlan", subscriptionPlanSchema);
