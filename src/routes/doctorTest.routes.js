const express = require('express');
const router = express.Router();
const { getDoctorTestData } = require('../controllers/doctorTest.controller');
const { authGuard } = require('../middleware/authGuard');

/**
 * Test API endpoint for doctors
 * Returns all patients, appointments, orders, and stats in one call
 * This is for testing purposes only, not for production integration
 */
router.get('/test-data', authGuard(['DOCTOR']), getDoctorTestData);

module.exports = router;
