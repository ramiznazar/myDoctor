const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crm.controller');
const apiKeyAuth = require('../middleware/apiKeyAuth');

/**
 * CRM API Routes
 * These routes are for external CRM system integration
 * Requires API key authentication via x-api-key header
 */

// Apply API key authentication to all CRM routes
router.use(apiKeyAuth);

// Get comprehensive CRM data
router.get('/data', crmController.getCrmData);

module.exports = router;
