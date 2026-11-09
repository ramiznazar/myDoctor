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

// Leo X24 project leads and analytics feed.
router.get('/leads', crmController.getCrmLeads);

// Legacy comprehensive feed retained for backwards compatibility.
router.get('/data', crmController.getCrmData);

module.exports = router;
