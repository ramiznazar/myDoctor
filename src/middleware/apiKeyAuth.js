const crypto = require('crypto');
const config = require('../config/env');

/**
 * Authenticates CRM server-to-server requests. This must not use an ordinary
 * user subscription policy: Leo X24 is the configured platform connector, not
 * a doctor browsing a CRM feature. It accepts the established Bearer and
 * custom-header formats so project configuration can remain consistent with
 * the other Leo X24 integrations.
 */
const apiKeyAuth = (req, res, next) => {
  const authorization = String(req.headers.authorization || '');
  const apiKey = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : String(
      req.headers['x-crm-api-key']
      || req.headers['x-api-key']
      || req.headers['x-apikey']
      || '',
    ).trim();
  const validApiKey = process.env.CRM_API_KEY || config.CRM_API_KEY;

  if (!validApiKey) {
    return res.status(500).json({
      success: false,
      message: 'CRM integration is not configured',
    });
  }

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: 'CRM API key is required',
    });
  }

  const expected = Buffer.from(String(validApiKey), 'utf8');
  const provided = Buffer.from(apiKey, 'utf8');
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return res.status(403).json({
      success: false,
      message: 'Invalid CRM API key',
    });
  }

  return next();
};

module.exports = apiKeyAuth;
