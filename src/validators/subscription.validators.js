const { z } = require("zod");

/**
 * Create subscription plan validator
 */
const createSubscriptionPlanValidator = z.object({
  body: z.object({
    name: z.enum(["BASIC", "MEDIUM", "FULL"], {
      errorMap: () => ({ message: "Plan name must be BASIC, MEDIUM, or FULL" })
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
  body: z.object({
    name: z.enum(["BASIC", "MEDIUM", "FULL"]).optional(),
    price: z.number().nonnegative("Price must be non-negative").optional(),
    durationInDays: z.number().int().positive("Duration must be a positive integer").optional(),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().optional()
  }),
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
