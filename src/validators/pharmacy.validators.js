const { z } = require("zod");

/**
 * Create pharmacy validator
 * ownerId is optional (auto-set by backend)
 */
const createPharmacyValidator = z.object({
  body: z.object({
    ownerId: z.string().min(1).optional(), // Optional - auto-set by backend
    kind: z.enum(['PHARMACY', 'PARAPHARMACY']).optional(),
    name: z.string().min(1, "Pharmacy name is required"),
    logo: z.union([
      z.string().url("Invalid logo URL"),
      z.string().regex(/^\/uploads\//, "Logo must be a valid URL or upload path"),
      z.literal("")
    ]).optional().transform((val) => val === "" ? undefined : val),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zip: z.string().optional()
    }).optional(),
    phone: z.string().optional().or(z.literal("").transform(() => undefined)),
    location: z.object({
      lat: z.preprocess(
        (val) => {
          if (val === "" || val === null || val === undefined) return undefined;
          const num = typeof val === "string" ? parseFloat(val) : val;
          return isNaN(num) ? undefined : num;
        },
        z.number().optional()
      ),
      lng: z.preprocess(
        (val) => {
          if (val === "" || val === null || val === undefined) return undefined;
          const num = typeof val === "string" ? parseFloat(val) : val;
          return isNaN(num) ? undefined : num;
        },
        z.number().optional()
      )
    }).optional(),
    isActive: z.boolean().optional()
  })
});

/**
 * Pharmacy buy subscription plan validator
 */
const buySubscriptionPlanValidator = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required")
  })
});

/**
 * Update pharmacy validator
 */
const updatePharmacyValidator = z.object({
  body: z.object({
    ownerId: z.string().min(1).optional(),
    kind: z.enum(['PHARMACY', 'PARAPHARMACY']).optional(),
    name: z.string().min(1).optional(),
    logo: z.union([
      z.string().url("Invalid logo URL"),
      z.string().regex(/^\/uploads\//, "Logo must be a valid URL or upload path"),
      z.literal("")
    ]).optional().transform((val) => val === "" ? undefined : val),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zip: z.string().optional()
    }).optional(),
    phone: z.string().optional(),
    location: z.object({
      lat: z.number().optional(),
      lng: z.number().optional()
    }).optional(),
    isActive: z.boolean().optional()
  }),
  params: z.object({
    id: z.string().min(1, "Pharmacy ID is required")
  })
});

module.exports = {
  createPharmacyValidator,
  updatePharmacyValidator,
  buySubscriptionPlanValidator
};

