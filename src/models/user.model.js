const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["ADMIN", "DOCTOR", "PATIENT", "PHARMACY"],
    default: null
  },
  fullName: {
    type: String,
    default: null
  },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    default: null
  },
  phone: {
    type: String,
    default: null
  },
  password: {
    type: String,
    select: false,
    default: null
  },
  status: {
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED", "BLOCKED"],
    default: null
  },
  profileImage: {
    type: String,
    default: null
  },
  gender: {
    type: String,
    enum: ["MALE", "FEMALE", "OTHER"],
    default: null
  },
  bloodGroup: {
    type: String,
    default: null
  },
  dob: {
    type: Date,
    default: null
  },
  address: {
    line1: { type: String, default: null },
    line2: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    zip: { type: String, default: null }
  },
  emergencyContact: {
    name: { type: String, default: null },
    phone: { type: String, default: null },
    relation: { type: String, default: null }
  },
  isDoctorDocumentsVerified: {
    type: Boolean,
    default: false
  },
  isPharmacyDocumentsVerified: {
    type: Boolean,
    default: false
  },
  documentUploads: {
    type: [
      {
        fileUrl: { type: String, default: null },
        type: { type: String, default: null }
      }
    ],
    default: null
  },
  subscriptionPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubscriptionPlan",
    default: null
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  },
  doctorProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DoctorProfile",
    default: null
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash password if it's been modified and is not already hashed
  if (!this.isModified('password')) {
    return next(); // Password not modified, skip
  }
  
  if (!this.password) {
    return next(); // No password to hash
  }
  
  // Check if password is already hashed (starts with bcrypt hash identifier)
  // bcrypt hashes always start with $2a$, $2b$, or $2y$ followed by cost parameter
  if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$') || this.password.startsWith('$2y$')) {
    return next(); // Password is already hashed, skip hashing to prevent double-hashing
  }
  
  // Password is plain text, hash it
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
