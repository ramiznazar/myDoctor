const { z } = require('zod');

/**
 * Base time slot schema (without refine for partial support)
 */
const baseTimeSlotSchema = z.object({
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format'),
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format'),
  isAvailable: z.boolean().optional().default(true)
});

/**
 * Time slot validator with refinement for full validation
 */
const timeSlotSchema = baseTimeSlotSchema.refine(
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
 * Upsert weekly schedule validator
 */
const upsertWeeklyScheduleValidator = z.object({
  body: z.object({
    dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
    timeSlots: z.array(timeSlotSchema).optional().default([])
  })
});

/**
 * Add time slot validator
 */
const addTimeSlotValidator = z.object({
  body: timeSlotSchema,
  params: z.object({
    dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])
  })
});

/**
 * Update time slot validator
 */
const updateTimeSlotValidator = z.object({
  body: baseTimeSlotSchema.partial(),
  params: z.object({
    dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
    slotId: z.string().min(1, 'Slot ID is required')
  })
});

/**
 * Update appointment duration validator
 */
const updateAppointmentDurationValidator = z.object({
  body: z.object({
    duration: z.enum([15, 30, 45, 60], 'Duration must be 15, 30, 45, or 60 minutes')
  })
});

/**
 * Get available slots validator
 */
const getAvailableSlotsValidator = z.object({
  query: z.object({
    doctorId: z.string().min(1, 'Doctor ID is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  })
});

module.exports = {
  upsertWeeklyScheduleValidator,
  addTimeSlotValidator,
  updateTimeSlotValidator,
  updateAppointmentDurationValidator,
  getAvailableSlotsValidator
};

