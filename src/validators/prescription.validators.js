const { z } = require('zod');

const medicationValidator = z.object({
  name: z.string().min(1, 'Medication name is required'),
  strength: z.string().nullish(),
  form: z.string().nullish(),
  route: z.string().nullish(),
  dosage: z.string().nullish(),
  frequency: z.string().nullish(),
  duration: z.string().nullish(),
  quantity: z.string().nullish(),
  refills: z.number().int().min(0).optional(),
  instructions: z.string().nullish(),
  substitutionAllowed: z.boolean().optional(),
  isPrn: z.boolean().optional()
});

const upsertPrescriptionForAppointmentValidator = z.object({
  params: z.object({
    appointmentId: z.string().min(1, 'Appointment ID is required')
  }),
  body: z.object({
    diagnosis: z.string().max(2000).nullish(),
    clinicalNotes: z.string().max(5000).nullish(),
    allergies: z.string().max(2000).nullish(),
    medications: z.array(medicationValidator).optional(),
    tests: z.array(z.string().min(1)).optional(),
    advice: z.string().max(5000).nullish(),
    followUp: z.string().max(2000).nullish(),
    status: z.enum(['DRAFT', 'ISSUED']).optional()
  })
});

const appointmentIdParamValidator = z.object({
  params: z.object({
    appointmentId: z.string().min(1, 'Appointment ID is required')
  })
});

const prescriptionIdParamValidator = z.object({
  params: z.object({
    id: z.string().min(1, 'Prescription ID is required')
  })
});

const listPrescriptionsValidator = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
});

module.exports = {
  upsertPrescriptionForAppointmentValidator,
  appointmentIdParamValidator,
  prescriptionIdParamValidator,
  listPrescriptionsValidator
};
