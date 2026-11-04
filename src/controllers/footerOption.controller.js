const asyncHandler = require('../middleware/asyncHandler');
const service = require('../services/footerOption.service');

exports.get = asyncHandler(async (_req, res) => res.json({ success: true, data: await service.getFooterOptions() }));
exports.update = asyncHandler(async (req, res) => res.json({ success: true, data: await service.updateFooterOptions(req.body) }));
