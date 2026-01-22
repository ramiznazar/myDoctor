const { z } = require("zod");

/**
 * Send message validator
 * Supports both doctor-patient (with appointment) and admin-doctor (without appointment) conversations
 * At least one of message or attachments must be provided
 */
const sendMessageValidator = z.object({
  body: z.object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    patientId: z.string().min(1).optional(), // Required for doctor-patient chat
    adminId: z.string().min(1).optional(), // Required for admin-doctor chat
    appointmentId: z.string().min(1).optional(), // Required for doctor-patient chat
    message: z.string().min(1).optional(),
    attachments: z.array(
      z.object({
        type: z.string().optional(), // 'image' or 'file'
        url: z.string().min(1, "Attachment URL is required"), // Can be relative or absolute URL
        name: z.string().optional(), // File name
        size: z.number().optional() // File size in bytes
      })
    ).optional()
  }).refine(
    (data) => data.message || (data.attachments && data.attachments.length > 0),
    {
      message: "Either message or attachments must be provided"
    }
  ).refine(
    (data) => {
      // Either admin-doctor OR doctor-patient must be specified
      const isAdminDoctor = !!data.adminId;
      const isDoctorPatient = !!data.patientId && !!data.appointmentId;
      return isAdminDoctor || isDoctorPatient;
    },
    {
      message: "Either adminId (for admin-doctor chat) or patientId+appointmentId (for doctor-patient chat) must be provided"
    }
  )
});

/**
 * Get conversation messages validator
 */
const getConversationMessagesValidator = z.object({
  params: z.object({
    conversationId: z.string().min(1, "Conversation ID is required")
  }),
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("20")
  }).optional()
});

/**
 * Create or get conversation validator
 * Supports both doctor-patient (with appointment) and admin-doctor (without appointment) conversations
 * adminId is optional in body as it will be fetched from token for ADMIN users
 */
const createOrGetConversationValidator = z.object({
  body: z.object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    patientId: z.string().min(1).optional(), // Required for doctor-patient chat
    adminId: z.string().min(1).optional(), // Optional - will be fetched from token for ADMIN users
    appointmentId: z.string().min(1).optional() // Required for doctor-patient chat
  }).refine(
    (data) => {
      // Either admin-doctor OR doctor-patient must be specified
      // adminId can be in body or will be from token
      const isDoctorPatient = !!data.patientId && !!data.appointmentId;
      // For admin-doctor, adminId will be from token, so we just need doctorId
      return true; // Validation will be done in service based on user role
    },
    {
      message: "Either patientId+appointmentId (for doctor-patient chat) or doctorId (for admin-doctor chat) must be provided"
    }
  )
});

module.exports = {
  sendMessageValidator,
  getConversationMessagesValidator,
  createOrGetConversationValidator
};

