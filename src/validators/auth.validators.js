const { z } = require("zod");

/**
 * Register validator - for patient/doctor registration
 */
const registerValidator = z.object({
  body: z.object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: z.enum(["DOCTOR", "PATIENT"], {
      errorMap: () => ({ message: "Role must be either DOCTOR or PATIENT" })
    }),
    phone: z.string().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    dob: z.string().optional(), // ISO date string
    profileImage: z.string().url("Invalid profile image URL").optional(),
    specializationId: z.string().min(1).optional() // if DOCTOR, frontend should send it
  })
});

/**
 * Login validator
 */
const loginValidator = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required")
  })
});

/**
 * Admin approve doctor validator
 */
const adminApproveDoctorValidator = z.object({
  body: z.object({
    doctorId: z.string().min(1, "Doctor ID is required")
  })
});

/**
 * Change password validator
 */
const changePasswordValidator = z.object({
  body: z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters")
  })
});

/**
 * Refresh token validator
 */
const refreshTokenValidator = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required")
  })
});

/**
 * Request password reset validator
 */
const requestPasswordResetValidator = z.object({
  body: z.object({
    email: z.string().email("Invalid email format")
  })
});

/**
 * Verify password reset code validator
 */
const verifyPasswordResetCodeValidator = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    code: z.string().length(6, "Verification code must be 6 digits").regex(/^\d+$/, "Verification code must contain only digits")
  })
});

/**
 * Reset password validator
 */
const resetPasswordValidator = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    code: z.string().length(6, "Verification code must be 6 digits").regex(/^\d+$/, "Verification code must contain only digits"),
    newPassword: z.string().min(6, "New password must be at least 6 characters")
  })
});

module.exports = {
  registerValidator,
  loginValidator,
  adminApproveDoctorValidator,
  changePasswordValidator,
  refreshTokenValidator,
  requestPasswordResetValidator,
  verifyPasswordResetCodeValidator,
  resetPasswordValidator
};
