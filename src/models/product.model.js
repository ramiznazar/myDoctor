const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  sellerType: {
    type: String,
    enum: ["DOCTOR", "PHARMACY", "ADMIN"],
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
