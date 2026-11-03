const { z } = require('zod');
const submitValidator = z.object({ body: z.object({ productId: z.string().min(1), variantId: z.string().optional().nullable(), prescriptionUrl: z.string().min(1), originalName: z.string().max(255).optional(), mimeType: z.string().max(150).optional() }) });
const reviewValidator = z.object({ params: z.object({ id: z.string().min(1) }), body: z.object({ status: z.enum(['APPROVED', 'REJECTED']), reviewNotes: z.string().max(2000).optional() }) });
module.exports = { submitValidator, reviewValidator };
