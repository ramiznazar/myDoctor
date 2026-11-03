const express = require('express');
const router = express.Router();
const controller = require('../controllers/productPrescriptionRequest.controller');
const authGuard = require('../middleware/authGuard');
const validate = require('../middleware/validate');
const { submitValidator, reviewValidator } = require('../validators/productPrescriptionRequest.validators');

router.get('/mine', authGuard(['PATIENT']), controller.listMine);
router.get('/product/:productId/eligibility', authGuard(['PATIENT']), controller.getEligibility);
router.post('/', authGuard(['PATIENT']), validate(submitValidator), controller.submit);
router.get('/seller', authGuard(['PHARMACY', 'PARAPHARMACY']), controller.listForSeller);
router.get('/seller/pending-count', authGuard(['PHARMACY', 'PARAPHARMACY']), controller.countPending);
router.put('/:id/review', authGuard(['PHARMACY', 'PARAPHARMACY']), validate(reviewValidator), controller.review);
module.exports = router;
