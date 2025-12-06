const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Conversation",
    default: null
  },
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
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  message: {
    type: String,
    default: null
  },
  attachments: {
    type: [
      {
        type: { type: String, default: null },
        url: { type: String, default: null }
      }
    ],
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
