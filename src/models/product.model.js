const mongoose = require('mongoose');

const productVariantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  sku: { type: String, default: null, trim: true },
  barcode: { type: String, default: null, trim: true },
  strengthValue: { type: Number, default: null, min: 0 },
  strengthUnit: { type: String, default: null, trim: true },
  dosageForm: { type: String, default: null, trim: true },
  packageType: { type: String, default: null, trim: true },
  unitsPerPack: { type: Number, default: null, min: 0 },
  unitLabel: { type: String, default: null, trim: true },
  packageDescription: { type: String, default: null, trim: true },
  price: { type: Number, required: true, min: 0 },
  discountPrice: { type: Number, default: null, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { _id: true });

const medicineDetailsSchema = new mongoose.Schema({
  activeIngredients: { type: String, default: null },
  administrationRoute: { type: String, default: null },
  indications: { type: String, default: null },
  dosageInstructions: { type: String, default: null },
  warnings: { type: String, default: null },
  storageInstructions: { type: String, default: null },
  manufacturer: { type: String, default: null },
  authorizationHolder: { type: String, default: null },
  registrationNumber: { type: String, default: null },
  leafletUrl: { type: String, default: null },
}, { _id: false });

const parapharmacyDetailsSchema = new mongoose.Schema({
  productClass: { type: String, default: null },
  ingredients: { type: String, default: null },
  allergens: { type: String, default: null },
  usageInstructions: { type: String, default: null },
  warnings: { type: String, default: null },
  storageInstructions: { type: String, default: null },
  manufacturer: { type: String, default: null },
}, { _id: false });

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
    default: undefined,
    unique: true,
    sparse: true
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
    default: []
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
    default: []
  },
  productType: {
    type: String,
    enum: ['PHARMACY_MEDICINE', 'PARAPHARMACY_PRODUCT', 'GENERAL_PRODUCT'],
    default: 'GENERAL_PRODUCT'
  },
  brand: {
    type: String,
    default: null
  },
  manufacturer: {
    type: String,
    default: null
  },
  barcode: {
    type: String,
    default: null
  },
  requiresPrescription: {
    type: Boolean,
    default: false
  },
  medicineDetails: {
    type: medicineDetailsSchema,
    default: () => ({})
  },
  parapharmacyDetails: {
    type: parapharmacyDetailsSchema,
    default: () => ({})
  },
  variants: {
    type: [productVariantSchema],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

productSchema.index({ sellerId: 1, isActive: 1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ productType: 1, isActive: 1 });

module.exports = mongoose.model("Product", productSchema);
