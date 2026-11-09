const asyncHandler = require('../middleware/asyncHandler');
const crmService = require('../services/crm.service');

/**
 * Get comprehensive CRM data
 * This endpoint is for external CRM system integration
 * Requires API key authentication
 */
const getCrmData = asyncHandler(async (req, res) => {
  // Extract query parameters as filters
  const filters = {
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    patientId: req.query.patientId,
    doctorId: req.query.doctorId,
    orderStatus: req.query.orderStatus,
    appointmentStatus: req.query.appointmentStatus
  };

  // Remove undefined filters
  Object.keys(filters).forEach(key => {
    if (filters[key] === undefined) {
      delete filters[key];
    }
  });

  const data = await crmService.getCrmData(filters);

  res.json({
    success: true,
    data: data,
    message: 'CRM data retrieved successfully'
  });
});

/**
 * Read-only commercial and registration feed for Leo X24. The service
 * deliberately excludes medical records, prescription files and clinical
 * appointment content.
 */
const getCrmLeads = asyncHandler(async (req, res) => {
  const data = await crmService.getCrmLeads(req.query || {});
  res.json({
    success: true,
    data,
    message: 'CRM leads retrieved successfully',
  });
});

module.exports = {
  getCrmData,
  getCrmLeads,
};
