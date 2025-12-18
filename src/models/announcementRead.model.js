const mongoose = require('mongoose');

const announcementReadSchema = new mongoose.Schema({
  announcementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Announcement',
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isRead: {
    type: Boolean,
    default: true
  },
  readAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure one read record per doctor per announcement
announcementReadSchema.index({ announcementId: 1, doctorId: 1 }, { unique: true });

module.exports = mongoose.model('AnnouncementRead', announcementReadSchema);





