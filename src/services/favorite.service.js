const Favorite = require('../models/favorite.model');

/**
 * Add favorite doctor
 * @param {Object} data - Favorite data
 * @returns {Promise<Object>} Created favorite
 */
const addFavorite = async (data) => {
  const { doctorId, patientId } = data;

  // Check if already favorited
  const existing = await Favorite.findOne({ doctorId, patientId });
  if (existing) {
    throw new Error('Doctor is already in favorites');
  }

  const favorite = await Favorite.create({
    doctorId,
    patientId
  });

  return favorite;
};

/**
 * Remove favorite
 * @param {string} favoriteId - Favorite ID
 * @returns {Promise<Object>} Success message
 */
const removeFavorite = async (favoriteId) => {
  const favorite = await Favorite.findById(favoriteId);
  
  if (!favorite) {
    throw new Error('Favorite not found');
  }

  await Favorite.findByIdAndDelete(favoriteId);

  return { message: 'Favorite removed successfully' };
};

/**
 * List favorites for patient
 * @param {string} patientId - Patient ID
 * @param {Object} options - Pagination options
 * @returns {Promise<Object>} Favorites and pagination info
 */
const listFavorites = async (patientId, options = {}) => {
  const { page = 1, limit = 10 } = options;

  const skip = (page - 1) * limit;

  const [favorites, total] = await Promise.all([
    Favorite.find({ patientId })
      .populate('doctorId', 'fullName email phone profileImage')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Favorite.countDocuments({ patientId })
  ]);

  return {
    favorites,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = {
  addFavorite,
  removeFavorite,
  listFavorites
};

