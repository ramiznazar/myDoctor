const { HTTP_STATUS } = require('../types/enums');

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {Object|Array} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
const sendSuccess = (res, data = {}, message = 'OK', statusCode = HTTP_STATUS.OK) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {Array} errors - Array of error details
 * @param {number} statusCode - HTTP status code
 */
const sendError = (res, message = 'An error occurred', errors = [], statusCode = HTTP_STATUS.BAD_REQUEST) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors: Array.isArray(errors) ? errors : [errors]
  });
};

module.exports = {
  sendSuccess,
  sendError
};

