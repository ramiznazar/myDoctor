/**
 * Request logger middleware for development debugging
 * Logs incoming API requests with method, URL, timestamp, and userId if available
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requestLogger = (req, res, next) => {
  // Only log in development mode
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const method = req.method;
    const url = req.originalUrl || req.url;
    
    // Get userId if available (from authGuard or req.user)
    const userId = req.userId || req.user?._id?.toString() || 'anonymous';
    
    // Format: [2025-01-01 12:00:00] GET /auth/register (user: xyz)
    console.log(`[${timestamp}] ${method} ${url} (user: ${userId})`);
  }
  
  next();
};

module.exports = requestLogger;

