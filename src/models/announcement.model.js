const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: null
  },
  file: {
    type: String,
    default: null
  },
  link: {
    type: String,
    default: null
  },
  priority: {
    type: String,
    enum: ['NORMAL', 'IMPORTANT', 'URGENT'],
    default: 'NORMAL'
  },
  announcementType: {
    type: String,
    enum: ['BROADCAST', 'TARGETED'],
    required: true
  },
  targetCriteria: {
    // For targeted announcements
    specializationIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Specialization'
    }],
    subscriptionPlanIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SubscriptionPlan'
    }],
    location: {
      city: { type: String, default: null },
      state: { type: String, default: null },
      country: { type: String, default: null }
    },
    individualDoctorIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  expiryType: {
    type: String,
    enum: ['NO_EXPIRY', 'EXPIRE_AFTER_DATE', 'AUTO_HIDE_AFTER_READ'],
    default: 'NO_EXPIRY'
  },
  expiryDate: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
announcementSchema.index({ isActive: 1, expiryDate: 1, createdAt: -1 });
announcementSchema.index({ isPinned: -1, priority: -1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);





