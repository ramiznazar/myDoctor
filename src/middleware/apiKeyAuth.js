const config = require('../config/env');

/**
 * Middleware to authenticate requests using API key
 * Expects API key in header: x-api-key
 */
const apiKeyAuth = (req, res, next) => {
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

  next();
};

module.exports = apiKeyAuth;
