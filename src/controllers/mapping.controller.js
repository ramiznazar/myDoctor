const asyncHandler = require('../middleware/asyncHandler');
const mappingService = require('../services/mapping.service');

/**
 * Get route from patient to clinic
 */
exports.getRoute = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  
  if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
    return res.status(400).json({
      success: false,
      message: 'From and to coordinates are required'
    });
  }

  const result = await mappingService.getRoute(
    { lat: parseFloat(from.lat), lng: parseFloat(from.lng) },
    { lat: parseFloat(to.lat), lng: parseFloat(to.lng) }
  );
  
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get nearby clinics
 */
exports.getNearbyClinics = asyncHandler(async (req, res) => {
  const { lat, lng, radius } = req.query;
  
  if (!lat || !lng) {
    return res.status(400).json({
      success: false,
      message: 'Latitude and longitude are required'
    });
  }

  const result = await mappingService.getNearbyClinics(
    parseFloat(lat),
    parseFloat(lng),
    radius ? parseFloat(radius) : 10
  );
  
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Get clinic location by ID
 */
exports.getClinicLocation = asyncHandler(async (req, res) => {
  const result = await mappingService.getClinicLocation(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});












