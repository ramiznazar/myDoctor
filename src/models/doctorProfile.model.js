const mongoose = require('mongoose');

const doctorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  title: {
    type: String,
    default: null
  },
  biography: {
    type: String,
    default: null
  },
  specialization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Specialization",
    default: null
  },
  experienceYears: {
    type: Number,
    default: null
  },
  services: {
    type: [
      {
        name: { type: String, default: null },
        price: { type: Number, default: null }
      }
    ],
    default: null
  },
  consultationFees: {
    clinic: {
      type: Number,
      default: null
    },
    online: {
      type: Number,
      default: null
    }
  },
  clinics: {
    type: [
      {
        name: { type: String, default: null },
        address: { type: String, default: null },
        city: { type: String, default: null },
        state: { type: String, default: null },
        country: { type: String, default: null },
        phone: { type: String, default: null },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        images: {
          type: [String],
          default: null
        },
        timings: {
          type: [
            {
              dayOfWeek: { type: String, default: null },
              startTime: { type: String, default: null },
              endTime: { type: String, default: null }
            }
          ],
          default: null
        }
      }
    ],
    default: null
  },
  education: {
    type: [
      {
        degree: { type: String, default: null },
        college: { type: String, default: null },
        year: { type: String, default: null }
      }
    ],
    default: null
  },
  experience: {
    type: [
      {
        hospital: { type: String, default: null },
        fromYear: { type: String, default: null },
        toYear: { type: String, default: null },
        designation: { type: String, default: null }
      }
    ],
    default: null
  },
  awards: {
    type: [
      {
        title: { type: String, default: null },
        year: { type: String, default: null }
      }
    ],
    default: null
  },
  memberships: {
    type: [
      {
        name: { type: String, default: null }
      }
    ],
    default: null
  },
  ratingAvg: {
    type: Number,
    default: null
  },
  ratingCount: {
    type: Number,
    default: null
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isAvailableOnline: {
    type: Boolean,
    default: true
  },
  canSellProducts: {
    type: Boolean,
    default: false
  },
  socialLinks: {
    facebook: { type: String, default: null },
    instagram: { type: String, default: null },
    linkedin: { type: String, default: null },
    twitter: { type: String, default: null },
    website: { type: String, default: null }
  },
  // Computed flag to indicate profile completeness for dashboard access/visibility
  profileCompleted: {
    type: Boolean,
    default: false
  },
  // Insurance integration
  convenzionato: {
    type: Boolean,
    default: false
  },
  insuranceCompanies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "InsuranceCompany",
    default: []
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model("DoctorProfile", doctorProfileSchema);
