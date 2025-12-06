const { z } = require("zod");

/**
 * Send message validator
 * At least one of message or attachments must be provided
 */
const sendMessageValidator = z.object({
  body: z.object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    patientId: z.string().min(1, "Patient ID is required"),
    senderId: z.string().min(1, "Sender ID is required"),
    message: z.string().min(1).optional(),
    attachments: z.array(
      z.object({
        type: z.string(),
        url: z.string().url("Invalid attachment URL")
      })
    ).optional()
  }).refine(
    (data) => data.message || (data.attachments && data.attachments.length > 0),
    {
      message: "Either message or attachments must be provided"
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
 */
const createOrGetConversationValidator = z.object({
  body: z.object({
    doctorId: z.string().min(1, "Doctor ID is required"),
    patientId: z.string().min(1, "Patient ID is required")
  })
});

module.exports = {
  sendMessageValidator,
  getConversationMessagesValidator,
  createOrGetConversationValidator
};

