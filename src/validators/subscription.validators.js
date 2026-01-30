const { z } = require("zod");

/**
 * Create subscription plan validator
 */
const createSubscriptionPlanValidator = z.object({
  body: z.object({
    name: z.enum(["BASIC", "PRO", "PREMIUM"], {
      errorMap: () => ({ message: "Plan name must be BASIC, PRO, or PREMIUM" })
    }),
    price: z.number().nonnegative("Price must be non-negative"),
    durationInDays: z.number().int().positive("Duration must be a positive integer"),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().optional()
  })
});

/**
 * Update subscription plan validator
 */
const updateSubscriptionPlanValidator = z.object({
  body: z
    .object({
      price: z.number().nonnegative("Price must be non-negative")
    })
    .strict(),
  params: z.object({
    id: z.string().min(1, "Subscription plan ID is required")
  })
});

/**
 * Assign subscription to doctor validator
 */
const assignSubscriptionToDoctorValidator = z.object({
  body: z.object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    planId: z.string().min(1, "Plan ID is required")
  })
});

module.exports = {
  createSubscriptionPlanValidator,
  updateSubscriptionPlanValidator,
  assignSubscriptionToDoctorValidator
};
