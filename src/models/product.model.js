const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  sellerType: {
    type: String,
    enum: ["DOCTOR", "PHARMACY", "PARAPHARMACY", "ADMIN"],
    default: null
  },
  name: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: null
  },
  i18n: {
    name: {
      type: Map,
      of: String,
      default: undefined
    },
    description: {
      type: Map,
      of: String,
      default: undefined
    },
    category: {
      type: Map,
      of: String,
      default: undefined
    },
    subCategory: {
      type: Map,
      of: String,
      default: undefined
    }
  },
  sku: {
    type: String,
    default: null
  },
  price: {
    type: Number,
    default: null
  },
  discountPrice: {
    type: Number,
    default: null
  },
  images: {
    type: [String],
    default: null
  },
  stock: {
    type: Number,
    default: null
  },
  category: {
    type: String,
    default: null
  },
  subCategory: {
    type: String,
    default: null
  },
  tags: {
    type: [String],
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model("Product", productSchema);
