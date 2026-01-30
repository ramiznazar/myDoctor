const { z } = require("zod");

/**
 * Create subscription plan validator
 */
const subscriptionPlanCreateValidator = z.object({
  body: z.object({
    name: z.string().min(1, "Plan name is required"),
    price: z.number().nonnegative("Price must be non-negative"),
    durationInDays: z.number().int().positive("Duration must be a positive integer"),
    features: z.array(z.string()).optional()
  })
});

/**
 * Update subscription plan validator
 */
const subscriptionPlanUpdateValidator = z.object({
  body: z
    .object({
      price: z.number().nonnegative("Price must be non-negative")
    })
    .strict(),
  params: z.object({
    id: z.string().min(1, "Subscription plan ID is required")
  })
});

module.exports = {
  subscriptionPlanCreateValidator,
  subscriptionPlanUpdateValidator
};






























