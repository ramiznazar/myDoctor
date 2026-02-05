const { z } = require("zod");

const i18nValidator = z
  .object({
    title: z.record(z.string()).optional(),
    content: z.record(z.string()).optional(),
  })
  .optional();

/**
 * Create blog post validator
 */
const createBlogPostValidator = z.object({
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    content: z.string().min(10, "Content must be at least 10 characters"),
    i18n: i18nValidator,
    slug: z.string().optional(),
    coverImage: z.string().url("Invalid cover image URL").optional(),
    tags: z.array(z.string()).optional(),
    isPublished: z.boolean().optional(),
    publishedAt: z.string().optional()
  })
});

/**
 * Update blog post validator
 */
const updateBlogPostValidator = z.object({
  body: z.object({
    title: z.string().min(3, "Title must be at least 3 characters").optional(),
    content: z.string().min(10, "Content must be at least 10 characters").optional(),
    i18n: i18nValidator,
    slug: z.string().optional(),
    coverImage: z.string().url("Invalid cover image URL").optional(),
    tags: z.array(z.string()).optional(),
    isPublished: z.boolean().optional(),
    publishedAt: z.string().optional()
  }),
  params: z.object({
    id: z.string().min(1, "Blog post ID is required")
  })
});

/**
 * Filter blog posts validator (for listing)
 */
const filterBlogPostsValidator = z.object({
  query: z.object({
    authorId: z.string().optional(),
    isPublished: z.string().transform((val) => val === "true").optional(),
    tags: z.string().optional(), // comma-separated tags
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10")
  })
});

module.exports = {
  createBlogPostValidator,
  updateBlogPostValidator,
  filterBlogPostsValidator
};

