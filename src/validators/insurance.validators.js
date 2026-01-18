const { z } = require("zod");

/**
 * Create insurance company validator
 */
const createInsuranceCompanyValidator = z.object({
  body: z.object({
    name: z.string().min(2, "Insurance company name must be at least 2 characters"),
    logo: z.string().url("Logo must be a valid URL").optional().or(z.literal("")),
    isActive: z.boolean().optional()
  })
});

/**
 * Update insurance company validator
 */
const updateInsuranceCompanyValidator = z.object({
  body: z.object({
    name: z.string().min(2, "Insurance company name must be at least 2 characters").optional(),
    logo: z.string().url("Logo must be a valid URL").optional().or(z.literal("")),
    isActive: z.boolean().optional()
  }),
  params: z.object({
    id: z.string().min(1, "Insurance company ID is required")
  })
});

/**
 * Toggle status validator
 */
const toggleStatusValidator = z.object({
  params: z.object({
    id: z.string().min(1, "Insurance company ID is required")
  }),
  body: z.object({
    isActive: z.boolean()
  })
});

module.exports = {
  createInsuranceCompanyValidator,
  updateInsuranceCompanyValidator,
  toggleStatusValidator
};
