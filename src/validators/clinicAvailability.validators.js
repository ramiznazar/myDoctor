const { z } = require('zod');

/**
 * Time slot validator (same as weekly schedule)
 */
const timeSlotSchema = z.object({
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format'),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format'),
  isAvailable: z.boolean().optional().default(true)
}).refine(
  (data) => {
    const [startH, startM] = data.startTime.split(':').map(Number);
    const [endH, endM] = data.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return startMinutes < endMinutes;
  },
  {
    message: 'Start time must be before end time'
  }
);

/**
 * Day schedule validator
 */
const dayScheduleSchema = z.object({
  dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  isWorkingDay: z.boolean().optional().default(false),
  timeSlots: z.array(timeSlotSchema).optional().default([])
});

/**
 * Upsert clinic availability validator
 */
const upsertClinicAvailabilityValidator = z.object({
  body: z.object({
    clinicId: z.string().min(1, 'Clinic ID is required'),
    clinicName: z.string().optional(),
    appointmentDuration: z.enum([15, 30, 45, 60]).optional().default(30),
    days: z.array(dayScheduleSchema).optional()
  })
});

/**
 * Add clinic time slot validator
 */
const addClinicTimeSlotValidator = z.object({
  body: timeSlotSchema
});

/**
 * Update clinic time slot validator
 */
const updateClinicTimeSlotValidator = z.object({
  body: timeSlotSchema.partial()
});

/**
 * Get clinic available slots validator
 */
const getClinicAvailableSlotsValidator = z.object({
  query: z.object({
    doctorId: z.string().min(1, 'Doctor ID is required'),
    clinicId: z.string().min(1, 'Clinic ID is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  })
});

module.exports = {
  upsertClinicAvailabilityValidator,
  addClinicTimeSlotValidator,
  updateClinicTimeSlotValidator,
  getClinicAvailableSlotsValidator
};


