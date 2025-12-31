const asyncHandler = require('../middleware/asyncHandler');
const mappingService = require('../services/mapping.service');

/**
 * Get route from patient to clinic
 * Query params can be:
 * - Flat: ?fromLat=40.7128&fromLng=-74.0060&toLat=40.7580&toLng=-73.9855
 * - Nested: ?from[lat]=40.7128&from[lng]=-74.0060&to[lat]=40.7580&to[lng]=-73.9855
 * - Dot notation: ?from.lat=40.7128&from.lng=-74.0060&to.lat=40.7580&to.lng=-73.9855
 */
exports.getRoute = asyncHandler(async (req, res) => {
  // Try to parse nested object first (if using qs library or similar)
  let from, to;
  
  if (req.query.from && typeof req.query.from === 'object') {
    // Nested object format: from[lat]=...&from[lng]=...
    from = req.query.from;
    to = req.query.to;
  } else {
    // Flat format: fromLat=...&fromLng=... or from.lat=...&from.lng=...
    from = {
      lat: req.query['from.lat'] || req.query.fromLat || req.query.from_lat,
      lng: req.query['from.lng'] || req.query.fromLng || req.query.from_lng
    };
    to = {
      lat: req.query['to.lat'] || req.query.toLat || req.query.to_lat,
      lng: req.query['to.lng'] || req.query.toLng || req.query.to_lng
    };
  }
  
  if (!from || !to || !from.lat || !from.lng || !to.lat || !to.lng) {
    return res.status(400).json({
      success: false,
      message: 'From and to coordinates are required. Provide: fromLat, fromLng, toLat, toLng (or nested from/to objects)'
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














