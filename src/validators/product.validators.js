const { z } = require("zod");

/**
 * Create product validator
 */
const createProductValidator = z.object({
  body: z.object({
    sellerId: z.string().min(1, "Seller ID is required"),
    sellerType: z.enum(["DOCTOR", "PHARMACY"], {
      errorMap: () => ({ message: "Seller type must be DOCTOR or PHARMACY" })
    }),
    name: z.string().min(1, "Product name is required"),
    price: z.number().nonnegative("Price must be non-negative"),
    stock: z.number().int().nonnegative("Stock must be a non-negative integer"),
    description: z.string().optional(),
    sku: z.string().optional(),
    discountPrice: z.number().nonnegative("Discount price must be non-negative").optional(),
    images: z.array(z.string().url("Invalid image URL")).optional(),
    category: z.string().optional(),
    subCategory: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isActive: z.boolean().optional()
  })
});

/**
 * Update product validator
 */
const updateProductValidator = z.object({
  body: z.object({
    sellerId: z.string().min(1).optional(),
    sellerType: z.enum(["DOCTOR", "PHARMACY"]).optional(),
    name: z.string().min(1).optional(),
    price: z.number().nonnegative("Price must be non-negative").optional(),
    stock: z.number().int().nonnegative("Stock must be a non-negative integer").optional(),
    description: z.string().optional(),
    sku: z.string().optional(),
    discountPrice: z.number().nonnegative("Discount price must be non-negative").optional(),
    images: z.array(z.string().url("Invalid image URL")).optional(),
    category: z.string().optional(),
    subCategory: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isActive: z.boolean().optional()
  }),
  params: z.object({
    id: z.string().min(1, "Product ID is required")
  })
});

/**
 * Filter products validator (for listing)
 */
const filterProductsValidator = z.object({
  query: z.object({
    sellerId: z.string().optional(),
    sellerType: z.enum(["DOCTOR", "PHARMACY"]).optional(),
    category: z.string().optional(),
    subCategory: z.string().optional(),
    isActive: z.string().transform((val) => val === "true").optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10")
  })
});

module.exports = {
  createProductValidator,
  updateProductValidator,
  filterProductsValidator
};

