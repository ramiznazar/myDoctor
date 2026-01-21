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

module.exports = {
  getCrmData
};
