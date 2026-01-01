const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  discountPrice: {
    type: Number,
    default: null
  },
  total: {
    type: Number,
    required: true
  }
}, { _id: true });

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: false // Will be auto-generated in pre-save hook
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  pharmacyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pharmacy",
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true // Doctor/Pharmacy owner
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  shipping: {
    type: Number,
    default: 0
  },
  initialShipping: {
    type: Number,
    default: 0 // Initial shipping estimate
  },
  finalShipping: {
    type: Number,
    default: null // Final shipping fee set by pharmacy owner
  },
  shippingUpdatedAt: {
    type: Date,
    default: null // When shipping fee was updated
  },
  total: {
    type: Number,
    required: true
  },
  initialTotal: {
    type: Number,
    default: null // Initial total before shipping update
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],
    default: 'PENDING'
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'PARTIAL', 'REFUNDED'],
    default: 'PENDING'
  },
  requiresPaymentUpdate: {
    type: Boolean,
    default: false // True when shipping fee is updated and patient needs to pay difference
  },
  paymentMethod: {
    type: String,
    default: null
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
    default: null
  },
  shippingAddress: {
    line1: { type: String, default: null },
    line2: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    country: { type: String, default: null },
    zip: { type: String, default: null }
  },
  notes: {
    type: String,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Generate unique order number before saving
orderSchema.pre('save', async function(next) {
  // Always generate order number if not already set
  if (!this.orderNumber || this.orderNumber.trim() === '') {
    let orderNumber;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Keep generating until we get a unique one
    while (!isUnique && attempts < maxAttempts) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      orderNumber = `ORD-${timestamp}-${random}`;
      
      // Check if this order number already exists
      const existingOrder = await this.constructor.findOne({ orderNumber });
      if (!existingOrder) {
        isUnique = true;
      }
      attempts++;
    }
    
    if (!isUnique) {
      // Fallback: use timestamp + random + additional random
      const timestamp = Date.now();
      const random1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const random2 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      orderNumber = `ORD-${timestamp}-${random1}-${random2}`;
    }
    
    this.orderNumber = orderNumber;
  }
  next();
});

// Index for faster queries
orderSchema.index({ patientId: 1, createdAt: -1 });
orderSchema.index({ ownerId: 1, createdAt: -1 });
orderSchema.index({ pharmacyId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderNumber: 1 });

module.exports = mongoose.model("Order", orderSchema);

