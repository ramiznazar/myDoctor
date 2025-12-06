const { z } = require("zod");

/**
 * Update user profile validator - for updating general user profile
 * (patient or doctor user-level fields, not DoctorProfile)
 */
const updateUserProfileValidator = z.object({
  body: z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
    phone: z.string().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    dob: z.string().optional(),
    profileImage: z.string().url("Invalid profile image URL").optional(),
    bloodGroup: z.string().optional(),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zip: z.string().optional()
    }).optional(),
    emergencyContact: z.object({
      name: z.string().optional(),
      phone: z.string().optional(),
      relation: z.string().optional()
    }).optional()
  })
});

/**
 * Update user status validator (admin use)
 */
const updateUserStatusValidator = z.object({
  body: z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "BLOCKED"], {
      errorMap: () => ({ message: "Invalid status value" })
    })
  }),
  params: z.object({
    id: z.string().min(1, "User ID is required")
  })
});

module.exports = {
  updateUserProfileValidator,
  updateUserStatusValidator
};
