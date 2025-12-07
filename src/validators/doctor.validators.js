const { z } = require("zod");

/**
 * Upsert doctor profile validator
 */
const upsertDoctorProfileValidator = z.object({
  body: z.object({
    title: z.string().optional(),
    biography: z.string().optional(),
    specializationId: z.string().min(1, "Specialization ID is required"),
    experienceYears: z.number().int().nonnegative("Experience years must be non-negative").optional(),
    services: z.array(
      z.object({
        name: z.string().min(1, "Service name is required"),
        price: z.number().nonnegative("Service price must be non-negative")
      })
    ).optional(),
    consultationFees: z.object({
      clinic: z.number().nonnegative("Clinic fee must be non-negative").optional(),
      online: z.number().nonnegative("Online fee must be non-negative").optional()
    }).optional(),
    clinics: z.array(
      z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        phone: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        images: z.array(z.string()).optional(),
        timings: z.array(
          z.object({
            dayOfWeek: z.string().optional(),
            startTime: z.string().optional(),
            endTime: z.string().optional()
          })
        ).optional()
      })
    ).optional(),
    education: z.array(
      z.object({
        degree: z.string().optional(),
        college: z.string().optional(),
        year: z.string().optional()
      })
    ).optional(),
    experience: z.array(
      z.object({
        hospital: z.string().optional(),
        fromYear: z.string().optional(),
        toYear: z.string().optional(),
        designation: z.string().optional()
      })
    ).optional(),
    awards: z.array(
      z.object({
        title: z.string().optional(),
        year: z.string().optional()
      })
    ).optional(),
    memberships: z.array(
      z.object({
        name: z.string().optional()
      })
    ).optional(),
    socialLinks: z.object({
      facebook: z.string().url("Invalid Facebook URL").optional(),
      instagram: z.string().url("Invalid Instagram URL").optional(),
      linkedin: z.string().url("Invalid LinkedIn URL").optional(),
      twitter: z.string().url("Invalid Twitter URL").optional(),
      website: z.string().url("Invalid website URL").optional()
    }).optional(),
    isFeatured: z.boolean().optional(),
    isAvailableOnline: z.boolean().optional(),
    canSellProducts: z.boolean().optional()
  })
});

/**
 * Doctor buy subscription plan validator
 */
const buySubscriptionPlanValidator = z.object({
  body: z.object({
    planId: z.string().min(1, "Plan ID is required")
  })
});

module.exports = {
  upsertDoctorProfileValidator,
  buySubscriptionPlanValidator
};

