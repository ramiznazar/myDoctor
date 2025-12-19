const { z } = require("zod");

/**
 * Create review validator
 * Supports both overall review and per-appointment review
 */
const createReviewValidator = z.object({
  body: z.object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    patientId: z.string().min(1, "Patient ID is required").optional(), // Optional if from token
    appointmentId: z.string().min(1).optional(), // Required for appointment-specific review
    rating: z.number().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
    reviewText: z.string().optional(),
    reviewType: z.enum(["OVERALL", "APPOINTMENT"]).optional() // Auto-determined if appointmentId provided
  })
});

/**
 * Update review validator
 */
const updateReviewValidator = z.object({
  body: z.object({
    rating: z.number().min(1).max(5).optional(),
    reviewText: z.string().optional()
  }),
  params: z.object({
    id: z.string().min(1, "Review ID is required")
  })
});

/**
 * Filter reviews validator (for listing)
 */
const filterReviewsValidator = z.object({
  query: z.object({
    doctorId: z.string().optional(),
    patientId: z.string().optional(),
    minRating: z.string().regex(/^\d+$/).transform(Number).optional(),
    maxRating: z.string().regex(/^\d+$/).transform(Number).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10")
  })
});

module.exports = {
  createReviewValidator,
  updateReviewValidator,
  filterReviewsValidator
};

