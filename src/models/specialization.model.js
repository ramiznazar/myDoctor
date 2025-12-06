const mongoose = require('mongoose');

const specializationSchema = new mongoose.Schema({
  name: {
    type: String,
    unique: true,
    default: null
  },
  slug: {
    type: String,
    unique: true,
    default: null
  },
  icon: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Specialization", specializationSchema);
