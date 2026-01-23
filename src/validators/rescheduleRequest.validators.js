const { z } = require("zod");

/**
 * Create reschedule request validator
 */
const createRescheduleRequestValidator = z.object({
  body: z.object({
    appointmentId: z.string().min(1, "Appointment ID is required"),
    reason: z.string()
      .min(10, "Reason must be at least 10 characters")
      .max(500, "Reason must not exceed 500 characters"),
    preferredDate: z.string()
      .min(1, "Preferred date must not be empty if provided")
      .nullish()
      .refine((val) => !val || val.trim().length > 0, {
        message: "Preferred date must not be empty if provided"
      }), // ISO date string (YYYY-MM-DD) or null/undefined
    preferredTime: z.string()
      .nullish()
      .refine((val) => !val || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val.trim()), {
        message: "Preferred time must be in HH:MM format (e.g., 14:30) if provided"
      }) // "HH:MM" format or null/undefined
  })
});

/**
 * Approve reschedule request validator
 */
const approveRescheduleRequestValidator = z.object({
  body: z.object({
    newAppointmentDate: z.string().min(1, "New appointment date is required"), // ISO date string
    newAppointmentTime: z.string().min(1, "New appointment time is required"), // "HH:MM" format
    rescheduleFee: z.number().min(0).optional(), // If not provided, uses default percentage
    rescheduleFeePercentage: z.number().min(0).max(100).optional(), // Override default percentage
    doctorNotes: z.string().max(500).optional()
  }),
  params: z.object({
    id: z.string().min(1, "Reschedule request ID is required")
  })
});

/**
 * Reject reschedule request validator
 */
const rejectRescheduleRequestValidator = z.object({
  body: z.object({
    rejectionReason: z.string()
      .min(10, "Rejection reason must be at least 10 characters")
      .max(500, "Rejection reason must not exceed 500 characters")
  }),
  params: z.object({
    id: z.string().min(1, "Reschedule request ID is required")
  })
});

/**
 * Pay reschedule fee validator
 */
const payRescheduleFeeValidator = z.object({
  body: z.object({
    paymentMethod: z.string().min(1, "Payment method is required").optional()
  }),
  params: z.object({
    id: z.string().min(1, "Reschedule request ID is required")
  })
});

module.exports = {
  createRescheduleRequestValidator,
  approveRescheduleRequestValidator,
  rejectRescheduleRequestValidator,
  payRescheduleFeeValidator
};
