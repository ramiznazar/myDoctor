const { z } = require('zod');

const imageUrl = z.union([z.string().url('Invalid image URL'), z.string().regex(/^\/uploads\//, 'Image must be a valid upload path')]);
const optionalText = z.string().max(5000).optional().nullable();
// `z.coerce.number()` turns an empty string into zero.  That is especially
// dangerous for prices and stock: an unfilled field looked like an intentional
// zero value.  Normalize blank optional values to null and make required
// numeric values explicitly reject blanks before coercion.
const toNumberOrBlank = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  return typeof value === 'string' ? Number(value) : value;
};
const optionalNumber = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    return value === '' || value === null ? null : toNumberOrBlank(value);
  },
  z.number({ invalid_type_error: 'Enter a valid number' }).nonnegative('Value must be non-negative').nullable().optional(),
);
const requiredNonNegativeNumber = (label) => z.preprocess(
  toNumberOrBlank,
  z.number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a valid number` })
    .nonnegative(`${label} must be non-negative`),
);
const requiredWholeNumber = (label) => z.preprocess(
  toNumberOrBlank,
  z.number({ required_error: `${label} is required`, invalid_type_error: `${label} must be a valid number` })
    .int(`${label} must be a whole number`).nonnegative(`${label} must be non-negative`),
);

const variantValidator = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, 'Variant name is required').max(180),
  sku: z.string().max(180).optional().nullable(),
  barcode: z.string().max(180).optional().nullable(),
  strengthValue: optionalNumber,
  strengthUnit: z.string().max(50).optional().nullable(),
  dosageForm: z.string().max(100).optional().nullable(),
  packageType: z.string().max(100).optional().nullable(),
  unitsPerPack: z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      return value === '' || value === null ? null : toNumberOrBlank(value);
    },
    z.number({ invalid_type_error: 'Units per pack must be a valid number' }).int('Units per pack must be a whole number').nonnegative('Units per pack must be non-negative').nullable().optional(),
  ),
  unitLabel: z.string().max(80).optional().nullable(),
  packageDescription: z.string().max(500).optional().nullable(),
  price: requiredNonNegativeNumber('Price'),
  discountPrice: optionalNumber,
  stock: requiredWholeNumber('Stock'),
  lowStockThreshold: z.preprocess(
    (value) => value === '' || value === null || value === undefined ? null : toNumberOrBlank(value),
    z.number({ invalid_type_error: 'Low-stock alert level must be a valid number' }).int('Low-stock alert level must be a whole number').nonnegative('Low-stock alert level must be non-negative').nullable().optional(),
  ),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const medicineDetailsValidator = z.object({
  activeIngredients: optionalText,
  administrationRoute: optionalText,
  indications: optionalText,
  dosageInstructions: optionalText,
  warnings: optionalText,
  storageInstructions: optionalText,
  manufacturer: optionalText,
  authorizationHolder: optionalText,
  registrationNumber: optionalText,
  leafletUrl: z.string().url().optional().nullable().or(z.literal('')),
}).optional();

const parapharmacyDetailsValidator = z.object({
  productClass: optionalText,
  ingredients: optionalText,
  allergens: optionalText,
  usageInstructions: optionalText,
  warnings: optionalText,
  storageInstructions: optionalText,
  manufacturer: optionalText,
}).optional();

const productFields = {
  name: z.string().min(1, 'Product name is required').max(250).optional(),
  price: optionalNumber,
  stock: z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      return value === '' || value === null ? null : toNumberOrBlank(value);
    },
    z.number({ invalid_type_error: 'Stock must be a valid number' }).int('Stock must be a whole number').nonnegative('Stock must be non-negative').nullable().optional(),
  ),
  lowStockThreshold: z.preprocess(
    (value) => value === '' || value === null || value === undefined ? undefined : toNumberOrBlank(value),
    z.number({ invalid_type_error: 'Low-stock alert level must be a valid number' }).int('Low-stock alert level must be a whole number').nonnegative('Low-stock alert level must be non-negative').optional(),
  ),
  description: optionalText,
  i18n: z.object({
    name: z.record(z.string()).optional(), description: z.record(z.string()).optional(),
    category: z.record(z.string()).optional(), subCategory: z.record(z.string()).optional(),
  }).optional(),
  sku: z.string().max(180).optional().nullable(),
  discountPrice: optionalNumber,
  images: z.array(imageUrl).max(8).optional(),
  category: z.string().max(150).optional().nullable(),
  subCategory: z.string().max(150).optional().nullable(),
  tags: z.array(z.string().min(1).max(60)).max(20).optional(),
  productType: z.enum(['PHARMACY_MEDICINE', 'PARAPHARMACY_PRODUCT', 'GENERAL_PRODUCT']).optional(),
  brand: z.string().max(150).optional().nullable(),
  manufacturer: z.string().max(150).optional().nullable(),
  barcode: z.string().max(180).optional().nullable(),
  requiresPrescription: z.boolean().optional(),
  medicineDetails: medicineDetailsValidator,
  parapharmacyDetails: parapharmacyDetailsValidator,
  variants: z.array(variantValidator).min(1, 'At least one variant is required').max(50).optional(),
  isActive: z.boolean().optional(),
};

const createProductValidator = z.object({
  body: z.object({ ...productFields, name: z.string().min(1, 'Product name is required').max(250), price: requiredNonNegativeNumber('Price'), stock: requiredWholeNumber('Stock'), sellerId: z.string().optional(), sellerType: z.enum(['DOCTOR', 'PHARMACY', 'PARAPHARMACY', 'ADMIN']).optional(), pharmacyId: z.string().optional() }),
});

const updateProductValidator = z.object({
  body: z.object(productFields),
  params: z.object({ id: z.string().min(1, 'Product ID is required') }),
});

const filterProductsValidator = z.object({
  query: z.object({
    sellerId: z.string().optional(), sellerType: z.enum(['DOCTOR', 'PHARMACY', 'PARAPHARMACY', 'ADMIN']).optional(),
    category: z.string().optional(), subCategory: z.string().optional(), isActive: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
  }),
});

module.exports = { createProductValidator, updateProductValidator, filterProductsValidator };
