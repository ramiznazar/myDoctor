const { z } = require("zod");

/**
 * Create specialization validator
 */
const createSpecializationValidator = z.object({
  body: z.object({
    name: z.string().min(2, "Specialization name must be at least 2 characters"),
    slug: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional()
  })
});

/**
 * Update specialization validator
 */
const updateSpecializationValidator = z.object({
  body: z.object({
    name: z.string().min(2, "Specialization name must be at least 2 characters").optional(),
    slug: z.string().optional(),
    description: z.string().optional(),
    icon: z.string().optional()
  }),
  params: z.object({
    id: z.string().min(1, "Specialization ID is required")
  })
});

module.exports = {
  createSpecializationValidator,
  updateSpecializationValidator
};

