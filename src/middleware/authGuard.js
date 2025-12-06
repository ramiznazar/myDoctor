const jwt = require('jsonwebtoken');
const { sendError } = require('../utils/response');
const { HTTP_STATUS } = require('../types/enums');
const config = require('../config/env');
const User = require('../models/user.model');

/**
 * Authentication and authorization guard middleware
 * Protects routes & enforces role-based access control
 * 
 * @param {Array<string>} allowedRoles - Array of allowed roles (e.g., ["ADMIN"], ["DOCTOR", "PATIENT"])
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.get('/admin', authGuard(["ADMIN"]), controller.adminRoute);
 * router.get('/doctor', authGuard(["DOCTOR", "PATIENT"]), controller.doctorRoute);
 */
const authGuard = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendError(
          res,
          'Unauthorized',
          [{ message: 'No token provided' }],
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix

      if (!token) {
        return sendError(
          res,
          'Unauthorized',
          [{ message: 'No token provided' }],
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      // Verify token using JWT_SECRET
      let decoded;
      try {
        decoded = jwt.verify(token, config.JWT_SECRET);
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return sendError(
            res,
            'Unauthorized',
            [{ message: 'Token has expired' }],
            HTTP_STATUS.UNAUTHORIZED
          );
        }
        return sendError(
          res,
          'Unauthorized',
          [{ message: 'Invalid token' }],
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      // Extract userId and role from payload
      const { userId, role } = decoded;

      if (!userId) {
        return sendError(
          res,
          'Unauthorized',
          [{ message: 'Invalid token payload' }],
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      // Get user from database
      const user = await User.findById(userId).select('-password');
      
      if (!user) {
        return sendError(
          res,
          'Unauthorized',
          [{ message: 'User not found' }],
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      // Check if user is blocked or rejected
      if (user.status === 'BLOCKED' || user.status === 'REJECTED') {
        return sendError(
          res,
          'Unauthorized',
          [{ message: 'User account is blocked or rejected' }],
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      // Check role authorization if roles are specified
      if (allowedRoles.length > 0) {
        const userRole = user.role?.toUpperCase();
        const isAuthorized = allowedRoles.some(allowedRole => 
          allowedRole.toUpperCase() === userRole
        );

        if (!isAuthorized) {
          return sendError(
            res,
            'Unauthorized',
            [{ message: 'Insufficient permissions' }],
            HTTP_STATUS.FORBIDDEN
          );
        }
      }

      // Attach user to request object
      req.user = user;
      req.userId = user._id.toString();
      req.userRole = user.role?.toUpperCase();

      next();
    } catch (error) {
      return sendError(
        res,
        'Unauthorized',
        [{ message: error.message || 'Authentication error' }],
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  };
};

module.exports = authGuard;
