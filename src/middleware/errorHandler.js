const { sendError } = require('../utils/response');
const { HTTP_STATUS } = require('../types/enums');

/**
 * Global error handler middleware
 * Catches ALL errors from anywhere and returns clean JSON
 * Must be added as last middleware in app.js
 * 
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message = err.message || 'Internal server error';
  let errors = [];

  // Handle ZodError specifically
  if (err.name === 'ZodError' || err.issues) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Validation error';
    // ZodError has 'issues' array
    if (err.issues && Array.isArray(err.issues)) {
      errors = err.issues.map(issue => ({
        field: issue.path?.join('.') || 'unknown',
        message: issue.message || 'Validation failed'
      }));
    } else {
      errors = [{ message: 'Validation failed' }];
    }
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Validation error';
    errors = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message
    }));
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Duplicate field value';
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    errors = [{ 
      field, 
      message: `${field} already exists` 
    }];
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Invalid ID format';
    errors = [{ message: 'Invalid resource ID' }];
  }

  // JWT errors - handle gracefully
  if (err.name === 'JsonWebTokenError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = 'Invalid token';
    errors = [{ message: 'Token is invalid' }];
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = 'Token expired';
    errors = [{ message: 'Token has expired' }];
  }

  // Custom application errors with statusCode
  if (err.statusCode && err.statusCode < 500) {
    statusCode = err.statusCode;
    message = err.message || message;
    if (err.errors) {
      errors = Array.isArray(err.errors) ? err.errors : [err.errors];
    }
  }

  // Log error in development
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
    console.error('\n❌ ========== ERROR HANDLER ==========');
    console.error('❌ Error Message:', err.message);
    console.error('❌ Error Name:', err.name);
    console.error('❌ Status Code:', statusCode);
    console.error('❌ Request URL:', req.url);
    console.error('❌ Request Method:', req.method);
    console.error('❌ Request Body:', req.body);
    console.error('❌ Error Stack:', err.stack);
    if (err.response) {
      console.error('❌ Error Response:', err.response);
    }
    console.error('❌ ====================================\n');
  }

  // Send error response
  // This should NEVER crash the server
  try {
    sendError(res, message, errors, statusCode);
  } catch (sendError) {
    // Fallback if sendError fails
    res.status(statusCode).json({
      success: false,
      message: message || 'Internal server error',
      errors: errors.length > 0 ? errors : []
    });
  }
};

module.exports = errorHandler;
