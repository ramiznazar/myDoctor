const multer = require('multer');
const { getMulterStorage } = require('../config/upload');
const { sendError } = require('../utils/response');
const { HTTP_STATUS } = require('../types/enums');

/**
 * Upload single image middleware
 * @param {string} folderName - Folder name for upload
 * @returns {Function} Express middleware
 */
const uploadSingleImage = (folderName) => {
  const storage = getMulterStorage(folderName);

  const fileFilter = (req, file, cb) => {
    // Accept only image files
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
    }
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024 // 5MB
    }
  });

  return (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(
              res,
              'File too large',
              [{ message: 'File size must be less than 5MB' }],
              HTTP_STATUS.BAD_REQUEST
            );
          }
          return sendError(
            res,
            'Upload error',
            [{ message: err.message }],
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        // File filter error
        return sendError(
          res,
          'Invalid file',
          [{ message: err.message }],
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (!req.file) {
        return sendError(
          res,
          'No file uploaded',
          [{ message: 'Please select a file to upload' }],
          HTTP_STATUS.BAD_REQUEST
        );
      }

      next();
    });
  };
};

/**
 * Upload multiple images middleware
 * @param {string} folderName - Folder name for upload
 * @param {number} maxCount - Maximum number of files allowed
 * @returns {Function} Express middleware
 */
const uploadMultipleImages = (folderName, maxCount = 10) => {
  const storage = getMulterStorage(folderName);

  const fileFilter = (req, file, cb) => {
    // Accept only image files
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
    }
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB per file
      files: maxCount
    }
  });

  return (req, res, next) => {
    upload.array('files', maxCount)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(
              res,
              'File too large',
              [{ message: 'Each file size must be less than 5MB' }],
              HTTP_STATUS.BAD_REQUEST
            );
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return sendError(
              res,
              'Too many files',
              [{ message: `Maximum ${maxCount} files allowed` }],
              HTTP_STATUS.BAD_REQUEST
            );
          }
          return sendError(
            res,
            'Upload error',
            [{ message: err.message }],
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        // File filter error
        return sendError(
          res,
          'Invalid file',
          [{ message: err.message }],
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (!req.files || req.files.length === 0) {
        return sendError(
          res,
          'No files uploaded',
          [{ message: 'Please select at least one file to upload' }],
          HTTP_STATUS.BAD_REQUEST
        );
      }

      next();
    });
  };
};

/**
 * Upload single file for chat (supports all file types)
 * @param {string} folderName - Folder name for upload
 * @returns {Function} Express middleware
 */
const uploadSingleChatFile = (folderName) => {
  const storage = getMulterStorage(folderName);

  const fileFilter = (req, file, cb) => {
    // Accept all file types for chat (medical documents, images, PDFs, etc.)
    // Common medical file types:
    // Images: jpeg, jpg, png, gif, webp, bmp, tiff
    // Documents: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, rtf
    // Medical: dicom, dcm (DICOM images), hl7 (HL7 messages)
    // Archives: zip, rar, 7z
    // Other: csv, xml, json
    
    // Allow all MIME types for maximum compatibility
    cb(null, true);
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB for chat files (larger than images)
    }
  });

  return (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(
              res,
              'File too large',
              [{ message: 'File size must be less than 50MB' }],
              HTTP_STATUS.BAD_REQUEST
            );
          }
          return sendError(
            res,
            'Upload error',
            [{ message: err.message }],
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        // File filter error
        return sendError(
          res,
          'Invalid file',
          [{ message: err.message }],
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (!req.file) {
        return sendError(
          res,
          'No file uploaded',
          [{ message: 'Please select a file to upload' }],
          HTTP_STATUS.BAD_REQUEST
        );
      }

      next();
    });
  };
};

/**
 * Upload multiple files for chat (supports all file types)
 * @param {string} folderName - Folder name for upload
 * @param {number} maxCount - Maximum number of files allowed
 * @returns {Function} Express middleware
 */
const uploadMultipleChatFiles = (folderName, maxCount = 10) => {
  const storage = getMulterStorage(folderName);

  const fileFilter = (req, file, cb) => {
    // Accept all file types for chat
    cb(null, true);
  };

  const upload = multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB per file
      files: maxCount
    }
  });

  return (req, res, next) => {
    upload.array('files', maxCount)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return sendError(
              res,
              'File too large',
              [{ message: 'Each file size must be less than 50MB' }],
              HTTP_STATUS.BAD_REQUEST
            );
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return sendError(
              res,
              'Too many files',
              [{ message: `Maximum ${maxCount} files allowed` }],
              HTTP_STATUS.BAD_REQUEST
            );
          }
          return sendError(
            res,
            'Upload error',
            [{ message: err.message }],
            HTTP_STATUS.BAD_REQUEST
          );
        }
        
        // File filter error
        return sendError(
          res,
          'Invalid file',
          [{ message: err.message }],
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (!req.files || req.files.length === 0) {
        return sendError(
          res,
          'No files uploaded',
          [{ message: 'Please select at least one file to upload' }],
          HTTP_STATUS.BAD_REQUEST
        );
      }

      next();
    });
  };
};

module.exports = {
  uploadSingleImage,
  uploadMultipleImages,
  uploadSingleChatFile,
  uploadMultipleChatFiles
};

