const asyncHandler = require('../middleware/asyncHandler');
const service = require('../services/contactQuery.service');

exports.create = asyncHandler(async (req, res) => res.status(201).json({ success: true, data: await service.createContactQuery(req.body) }));
exports.list = asyncHandler(async (req, res) => res.json({ success: true, data: await service.listContactQueries(req.query) }));
exports.get = asyncHandler(async (req, res) => res.json({ success: true, data: await service.getContactQuery(req.params.id) }));
exports.update = asyncHandler(async (req, res) => res.json({ success: true, data: await service.updateContactQuery(req.params.id, req.userId, req.body) }));
exports.remove = asyncHandler(async (req, res) => res.json({ success: true, data: await service.deleteContactQuery(req.params.id) }));
