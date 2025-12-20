const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  }
}, { _id: true });

const dayScheduleSchema = new mongoose.Schema({
  dayOfWeek: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  },
  timeSlots: {
    type: [timeSlotSchema],
    default: []
  }
}, { _id: false });

const weeklyScheduleSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  appointmentDuration: {
    type: Number,
    enum: [15, 30, 45, 60],
    default: 30
  },
  days: {
    type: [dayScheduleSchema],
    default: []
  }
}, {
  timestamps: true
});

// Note: doctorId already has an index due to unique: true above
// No need for explicit index definition

module.exports = mongoose.model('WeeklySchedule', weeklyScheduleSchema);

