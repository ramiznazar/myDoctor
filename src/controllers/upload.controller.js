const asyncHandler = require('../middleware/asyncHandler');
const path = require('path');
const User = require('../models/user.model');

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
 * For doctor documents, also updates the user's documentUploads field
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

  // If this is a doctor documents upload, update the user's documentUploads field
  // Check if the route is /doctor-docs by checking req.originalUrl or req.path
  const isDoctorDocsUpload = req.originalUrl?.includes('/doctor-docs') || 
                             req.path?.includes('doctor-docs') ||
                             req.baseUrl?.includes('doctor-docs') ||
                             req.url?.includes('doctor-docs');

  const isPharmacyDocsUpload = req.originalUrl?.includes('/pharmacy-docs') ||
                               req.path?.includes('pharmacy-docs') ||
                               req.baseUrl?.includes('pharmacy-docs') ||
                               req.url?.includes('pharmacy-docs');

  const docType = (req.body?.docType || req.query?.type || 'VERIFICATION_DOCUMENT');

  if ((isDoctorDocsUpload || isPharmacyDocsUpload) && req.userId) {
    try {
      const user = await User.findById(req.userId);
      if (
        user &&
        ((isDoctorDocsUpload && user.role === 'DOCTOR') ||
          (isPharmacyDocsUpload && (user.role === 'PHARMACY' || user.role === 'PARAPHARMACY')))
      ) {
        // Create document uploads array
        const documentUploads = urls.map(url => ({
          fileUrl: url,
          type: docType
        }));

        // Update user's documentUploads field
        // If documentUploads already exists, append to it; otherwise, set it
        if (user.documentUploads && Array.isArray(user.documentUploads)) {
          user.documentUploads = [...user.documentUploads, ...documentUploads];
        } else {
          user.documentUploads = documentUploads;
        }

        await user.save();
      }
    } catch (error) {
      // Log error but don't fail the upload
      console.error('Error updating user documentUploads:', error);
      // Continue with the response even if update fails
    }
  }

  res.json({
    success: true,
    message: 'Files uploaded successfully',
    data: { urls }
  });
});

