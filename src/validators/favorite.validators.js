const { z } = require("zod");

/**
 * Add favorite validator
 */
const addFavoriteValidator = z.object({
  body: z.object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    patientId: z.string().min(1, "Patient ID is required")
  })
});

/**
 * Remove favorite validator
 */
const removeFavoriteValidator = z.object({
  params: z.object({
    favoriteId: z.string().min(1, "Favorite ID is required")
  })
});

/**
 * Get favorites validator (for listing)
 */
const getFavoritesValidator = z.object({
  query: z.object({
    patientId: z.string().optional(),
    doctorId: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10")
  })
});

module.exports = {
  addFavoriteValidator,
  removeFavoriteValidator,
  getFavoritesValidator
};
