const asyncHandler = require('../middleware/asyncHandler');
const service = require('../services/productPrescriptionRequest.service');

exports.submit = asyncHandler(async (req, res) => res.status(201).json({ success: true, message: 'Prescription submitted for review', data: await service.submitRequest(req.userId, req.body) }));
exports.getEligibility = asyncHandler(async (req, res) => res.json({ success: true, message: 'OK', data: await service.getEligibility(req.userId, req.params.productId, req.query.variantId) }));
exports.listMine = asyncHandler(async (req, res) => res.json({ success: true, message: 'OK', data: await service.listMine(req.userId, req.query) }));
exports.listForSeller = asyncHandler(async (req, res) => res.json({ success: true, message: 'OK', data: await service.listForSeller(req.userId, req.query) }));
exports.review = asyncHandler(async (req, res) => res.json({ success: true, message: 'Prescription request reviewed', data: await service.reviewRequest(req.userId, req.params.id, req.body) }));
exports.countPending = asyncHandler(async (req, res) => res.json({ success: true, message: 'OK', data: await service.countPendingForSeller(req.userId) }));
