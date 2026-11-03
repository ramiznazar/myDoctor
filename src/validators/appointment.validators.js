const { z } = require("zod");

/**
 * Create appointment validator
 */
const createAppointmentValidator = z.object({
  body: z.object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    // The server derives the patient from the authenticated token. It remains
    // optional only for trusted internal service callers/backward-compatible
    // clients; it is never used as authority for a patient HTTP request.
    patientId: z.string().min(1, "Patient ID is required").optional(),
    appointmentDate: z.string().min(1, "Appointment date is required"), // ISO date
    appointmentTime: z.string().min(1, "Appointment time is required"), // "10:30"
    bookingType: z.enum(["VISIT", "ONLINE"]).optional(),
    patientNotes: z.string().optional(),
    clinicName: z.string().optional(),
    appointmentDuration: z.union([
      z.number(),
      z.string().regex(/^\d+$/).transform(Number)
    ]).optional(),
    selectedServices: z.array(
      z.union([
        z.string().min(1),
        z.object({
          name: z.string().min(1),
          price: z.number().optional()
        })
      ])
    ).optional(),
    timezone: z.string().optional(),
    timezoneOffset: z.union([
      z.number(),
      z.string().regex(/^-?\d+$/).transform(Number)
    ]).optional()
  })
});

/**
 * Booking quote validator (server-calculated checkout price)
 */
const bookingQuoteValidator = z.object({
  body: z.object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    bookingType: z.enum(["VISIT", "ONLINE"]).optional(),
    selectedServices: z.array(
      z.union([
        z.string().min(1),
        z.object({
          name: z.string().min(1),
          price: z.number().optional()
        })
      ])
    ).optional()
  })
});

/**
 * Update appointment status validator
 */
const updateAppointmentStatusValidator = z.object({
  body: z.object({
    status: z.enum(["PENDING", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW", "REJECTED"], {
      errorMap: () => ({ message: "Invalid appointment status" })
    }),
    paymentStatus: z.enum(["UNPAID", "PAID", "REFUNDED"]).optional(),
    paymentMethod: z.string().optional()
  }),
  params: z.object({
    id: z.string().min(1, "Appointment ID is required")
  })
});

/**
 * Filter appointments validator (for listing)
 */
const filterAppointmentsValidator = z.object({
  query: z.object({
    doctorId: z.string().optional(),
    patientId: z.string().optional(),
    status: z.enum(["PENDING", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW", "REJECTED"]).optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10")
  })
});

module.exports = {
  createAppointmentValidator,
  bookingQuoteValidator,
  updateAppointmentStatusValidator,
  filterAppointmentsValidator
};

