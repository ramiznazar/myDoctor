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
    profileImage: z.union([
      z.string().url("Invalid profile image URL"),
      z.string(), // Allow any string (including relative paths)
      z.null(),
      z.undefined()
    ]).optional(),
    bloodGroup: z.string().optional(),
    address: z.object({
      line1: z.union([z.string(), z.null(), z.undefined()]).optional(),
      line2: z.union([z.string(), z.null(), z.undefined()]).optional(),
      city: z.union([z.string(), z.null(), z.undefined()]).optional(),
      state: z.union([z.string(), z.null(), z.undefined()]).optional(),
      country: z.union([z.string(), z.null(), z.undefined()]).optional(),
      zip: z.union([z.string(), z.null(), z.undefined()]).optional()
    }).optional(),
    emergencyContact: z.object({
      name: z.union([z.string(), z.null(), z.undefined()]).optional(),
      phone: z.union([z.string(), z.null(), z.undefined()]).optional(),
      relation: z.union([z.string(), z.null(), z.undefined()]).optional()
    }).optional()
  }).passthrough() // Allow additional properties to be passed through
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
