// Global type definitions and JSDoc comments for better IDE support

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {string} message
 * @property {Object|Array} [data]
 * @property {Array} [errors]
 */

/**
 * @typedef {Object} User
 * @property {string} _id
 * @property {string} [email]
 * @property {string} [name]
 * @property {string} [password]
 * @property {string} [role]
 * @property {Date} [createdAt]
 * @property {Date} [updatedAt]
 */

/**
 * @typedef {Object} JwtPayload
 * @property {string} userId
 * @property {string} role
 * @property {string} email
 */

module.exports = {};

