const { z } = require("zod");

/**
 * Create order validator
 */
const createOrderValidator = z.object({
  body: z.object({
    items: z.array(
      z.object({
        productId: z.string().min(1, "Product ID is required"),
        quantity: z.number().int().positive("Quantity must be a positive integer")
      })
    ).min(1, "At least one item is required"),
    shippingAddress: z.object({
      line1: z.string().min(1, "Address line 1 is required"),
      line2: z.string().optional().nullable(),
      city: z.string().min(1, "City is required"),
      state: z.string().min(1, "State is required"),
      country: z.string().min(1, "Country is required"),
      zip: z.string().min(1, "ZIP code is required")
    }).optional().nullable(),
    paymentMethod: z.enum(['STRIPE']).optional().nullable()
  })
});

/**
 * Update order status validator
 */
const updateOrderStatusValidator = z.object({
  body: z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'], {
      errorMap: () => ({ message: "Invalid order status" })
    })
  }),
  params: z.object({
    id: z.string().min(1, "Order ID is required")
  })
});

/**
 * Filter orders validator
 */
const filterOrdersValidator = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    pharmacyId: z.string().optional(),
    patientId: z.string().optional()
  })
});

/**
 * Get order by ID validator
 */
const getOrderByIdValidator = z.object({
  params: z.object({
    id: z.string().min(1, "Order ID is required")
  })
});

/**
 * Update shipping fee validator
 */
const updateShippingFeeValidator = z.object({
  body: z.object({
    shippingFee: z.number().nonnegative("Shipping fee must be non-negative")
  }),
  params: z.object({
    id: z.string().min(1, "Order ID is required")
  })
});

/**
 * Pay for order validator
 */
const payForOrderValidator = z.object({
  body: z.object({
    paymentMethod: z.enum(['STRIPE']).optional()
  }),
  params: z.object({
    id: z.string().min(1, "Order ID is required")
  })
});

/**
 * Cancel order validator
 */
const cancelOrderValidator = z.object({
  params: z.object({
    id: z.string().min(1, "Order ID is required")
  })
});

module.exports = {
  createOrderValidator,
  updateOrderStatusValidator,
  filterOrdersValidator,
  getOrderByIdValidator,
  updateShippingFeeValidator,
  payForOrderValidator,
  cancelOrderValidator
};

