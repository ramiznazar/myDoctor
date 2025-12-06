const { z } = require('zod');
const { sendError } = require('../utils/response');
const { HTTP_STATUS } = require('../types/enums');

/**
 * Validation middleware using Zod schema
 * Supports validation of body, params, and query separately
 * 
 * @param {Object|z.ZodObject} validator - Zod schema object with optional body, params, query schemas
 * @returns {Function} Express middleware function
 * 
 * @example
 * // Validator already has body, params, query structure
 * validate(registerValidator) // where registerValidator = z.object({ body: z.object({...}) })
 * 
 * // Or pass object with separate schemas
 * validate({
 *   body: registerValidator,
 *   params: updateValidator,
 *   query: filterValidator
 * })
 */
const validate = (validator) => {
  return (req, res, next) => {
    try {
      // If validator is already a Zod schema (from validators), use it directly
      // Otherwise, build schema from object with body, params, query
      let schema;
      
      if (validator instanceof z.ZodObject || validator._def) {
        // Validator is already a Zod schema
        schema = validator;
      } else {
        // Build schema from object with body, params, query
        schema = z.object({
          body: validator.body || z.any().optional(),
          params: validator.params || z.any().optional(),
          query: validator.query || z.any().optional()
        });
      }

      // Prepare data to validate
      const dataToValidate = {
        body: req.body,
        params: req.params,
        query: req.query
      };

      // Validate the data
      const result = schema.safeParse(dataToValidate);

      if (!result.success) {
        const errors = result.error.errors.map(err => {
          const path = err.path.join('.');
          return {
            field: path,
            message: err.message
          };
        });

        return sendError(
          res,
          'Validation error',
          errors,
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Replace request data with validated data
      if (result.data.body) {
        req.body = result.data.body;
      }
      if (result.data.params) {
        req.params = result.data.params;
      }
      if (result.data.query) {
        req.query = result.data.query;
      }

      next();
    } catch (error) {
      return sendError(
        res,
        'Validation error',
        [{ message: error.message }],
        HTTP_STATUS.BAD_REQUEST
      );
    }
  };
};

module.exports = validate;
