const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
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
  lastMessageAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Conversation", conversationSchema);
