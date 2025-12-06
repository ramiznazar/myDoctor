const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * Get Multer storage configuration for a specific folder
 * @param {string} folderName - Folder name (profile, doctorDocs, clinic, product, blog, pharmacy, general)
 * @returns {Object} Multer diskStorage configuration
 */
const getMulterStorage = (folderName) => {
  // Map folder names to actual directory names
  const folderMap = {
    profile: 'profile',
    doctorDocs: 'doctor-documents',
    clinic: 'clinic',
    product: 'product',
    blog: 'blog',
    pharmacy: 'pharmacy',
    general: 'general'
  };

  const uploadFolder = folderMap[folderName] || 'general';
  const uploadPath = path.join(process.cwd(), 'uploads', uploadFolder);

  // Create directory if it doesn't exist
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Format: timestamp-originalname (spaces replaced with hyphens)
      const timestamp = Date.now();
      const sanitizedName = file.originalname.replace(/\s+/g, '-');
      const filename = `${timestamp}-${sanitizedName}`;
      cb(null, filename);
    }
  });
};

module.exports = {
  getMulterStorage
};

