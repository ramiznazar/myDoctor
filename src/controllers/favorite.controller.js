const asyncHandler = require('../middleware/asyncHandler');
const favoriteService = require('../services/favorite.service');

/**
 * Add favorite doctor
 */
exports.add = asyncHandler(async (req, res) => {
  const favoriteData = {
    ...req.body,
    patientId: req.userId
  };
  const result = await favoriteService.addFavorite(favoriteData);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * List favorites for patient
 */
exports.list = asyncHandler(async (req, res) => {
  const patientId = req.params.patientId || req.userId;
  const result = await favoriteService.listFavorites(patientId, req.query);
  res.json({ success: true, message: 'OK', data: result });
});

/**
 * Remove favorite
 */
exports.remove = asyncHandler(async (req, res) => {
  const result = await favoriteService.removeFavorite(req.params.id);
  res.json({ success: true, message: 'OK', data: result });
});

