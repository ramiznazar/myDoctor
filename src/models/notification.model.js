const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  title: {
    type: String,
    default: null
  },
  body: {
    type: String,
    default: null
  },
  i18n: {
    title: {
      type: Map,
      of: String,
      default: undefined
    },
    body: {
      type: Map,
      of: String,
      default: undefined
    }
  },
  type: {
    type: String,
    enum: [
      "APPOINTMENT",
      "PAYMENT",
      "SYSTEM",
      "SUBSCRIPTION",
      "CHAT",
      "OTHER"
    ],
    default: null
  },
  data: {
    type: Object,
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Notification", notificationSchema);
