const { z } = require("zod");

/**
 * Create pharmacy validator
 */
const createPharmacyValidator = z.object({
  body: z.object({
    ownerId: z.string().min(1, "Owner ID is required"),
    name: z.string().min(1, "Pharmacy name is required"),
    logo: z.string().url("Invalid logo URL").optional(),
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
  })
});

/**
 * Update pharmacy validator
 */
const updatePharmacyValidator = z.object({
  body: z.object({
    ownerId: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    logo: z.string().url("Invalid logo URL").optional(),
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
  updatePharmacyValidator
};

