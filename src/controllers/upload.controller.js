const asyncHandler = require('../middleware/asyncHandler');
const path = require('path');

/**
 * Upload single file controller
 */
exports.uploadSingleFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
      errors: [{ message: 'Please select a file to upload' }]
    });
  }

  // Get the relative path from uploads folder
  const filePath = path.relative(path.join(process.cwd(), 'uploads'), req.file.path);
  const url = `/uploads/${filePath.replace(/\\/g, '/')}`;

  res.json({
    success: true,
    message: 'File uploaded',
    data: { url }
  });
});

/**
 * Upload multiple files controller
 */
exports.uploadMultipleFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded',
      errors: [{ message: 'Please select at least one file to upload' }]
    });
  }

  // Get relative paths for all files
  const urls = req.files.map(file => {
    const filePath = path.relative(path.join(process.cwd(), 'uploads'), file.path);
    return `/uploads/${filePath.replace(/\\/g, '/')}`;
  });

  res.json({
    success: true,
    message: 'Files uploaded',
    data: { urls }
  });
});

