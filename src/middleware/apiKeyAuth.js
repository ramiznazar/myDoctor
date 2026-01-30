const config = require('../config/env');
 const subscriptionPolicy = require('../services/subscriptionPolicy.service');

/**
 * Middleware to authenticate requests using API key
 * Expects API key in header: x-api-key
 */
const apiKeyAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['x-apikey'] || req.query.apiKey;
  const validApiKey = process.env.CRM_API_KEY || config.CRM_API_KEY;

  if (!validApiKey) {
    console.warn('⚠️  CRM_API_KEY not set in environment variables');
    return res.status(500).json({
      success: false,
      message: 'API key authentication not configured'
    });
  }

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'API key is required. Please provide x-api-key header or apiKey query parameter.'
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({
      success: false,
      message: 'Invalid API key'
    });
  }

  try {
    const doctorId = req.query.doctorId;
    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: 'doctorId query parameter is required'
      });
    }

    await subscriptionPolicy.enforceCrmAccess({ doctorId });
    next();
  } catch (error) {
    const statusCode = error.statusCode || 403;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'CRM access denied'
    });
  }
};

module.exports = apiKeyAuth;
