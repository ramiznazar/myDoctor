const { z } = require("zod");

/**
 * Create transaction validator
 * (for internal use or webhooks)
 */
const createTransactionValidator = z.object({
  body: z.object({
    userId: z.string().min(1, "User ID is required"),
    amount: z.number().nonnegative("Amount must be non-negative"),
    currency: z.string().optional(),
    relatedAppointmentId: z.string().optional(),
    relatedSubscriptionId: z.string().optional(),
    relatedProductId: z.string().optional(),
    status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"]).optional(),
    provider: z.string().optional(),
    providerReference: z.string().optional()
  })
});

/**
 * Update transaction status validator
 */
const updateTransactionStatusValidator = z.object({
  body: z.object({
    status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"], {
      errorMap: () => ({ message: "Invalid transaction status" })
    })
  }),
  params: z.object({
    id: z.string().min(1, "Transaction ID is required")
  })
});

/**
 * Filter transactions validator (for listing)
 */
const filterTransactionsValidator = z.object({
  query: z.object({
    userId: z.string().optional(),
    status: z.enum(["PENDING", "SUCCESS", "FAILED", "REFUNDED"]).optional(),
    provider: z.string().optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10")
  })
});

module.exports = {
  createTransactionValidator,
  updateTransactionStatusValidator,
  filterTransactionsValidator
};

