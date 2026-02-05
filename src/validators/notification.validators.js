const { z } = require("zod");

const i18nValidator = z
  .object({
    title: z.record(z.string()).optional(),
    body: z.record(z.string()).optional(),
  })
  .optional();

/**
 * Create notification validator
 */
const createNotificationValidator = z.object({
  body: z.object({
    userId: z.string().min(1, "User ID is required"),
    title: z.string().min(1, "Title is required"),
    body: z.string().min(1, "Body is required"),
    i18n: i18nValidator,
    type: z.enum(["APPOINTMENT", "PAYMENT", "SYSTEM", "SUBSCRIPTION", "CHAT", "OTHER"]).optional(),
    data: z.any().optional()
  })
});

/**
 * Mark notification as read validator
 */
const markNotificationReadValidator = z.object({
  params: z.object({
    id: z.string({
      required_error: "Notification ID is required",
      invalid_type_error: "Notification ID must be a string"
    }).min(1, "Notification ID cannot be empty")
  }),
  body: z.any().optional(),
  query: z.any().optional()
}).passthrough();

/**
 * Get notifications validator (for listing)
 * userId is now fetched from token, not from query
 */
const getNotificationsValidator = z.object({
  query: z.object({
    type: z.enum(["APPOINTMENT", "PAYMENT", "SYSTEM", "SUBSCRIPTION", "CHAT", "OTHER"]).optional(),
    isRead: z.string().transform((val) => val === "true").optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("20")
  })
});

/**
 * Mark all notifications as read validator
 */
const markAllNotificationsReadValidator = z.object({
  body: z.object({
    userId: z.string().min(1, "User ID is required")
  })
});

module.exports = {
  createNotificationValidator,
  markNotificationReadValidator,
  getNotificationsValidator,
  markAllNotificationsReadValidator
};

