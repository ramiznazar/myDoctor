const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favorite.controller');
const { addFavoriteValidator } = require('../validators/favorite.validators');
const validate = require('../middleware/validate');
const authGuard = require('../middleware/authGuard');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @route   POST /api/favorite
 * @desc    Add favorite doctor
 * @access  Private (Patient)
 */
router.post(
  '/',
  authGuard(['PATIENT']),
  validate(addFavoriteValidator),
  asyncHandler(favoriteController.add)
);

/**
 * @route   GET /api/favorite/:patientId
 * @desc    List favorites for patient
 * @access  Private
 */
router.get(
  '/:patientId',
  authGuard([]),
  asyncHandler(favoriteController.list)
);

/**
 * @route   DELETE /api/favorite/:id
 * @desc    Remove favorite
 * @access  Private (Patient)
 */
router.delete(
  '/:id',
  authGuard(['PATIENT']),
  asyncHandler(favoriteController.remove)
);

module.exports = router;

