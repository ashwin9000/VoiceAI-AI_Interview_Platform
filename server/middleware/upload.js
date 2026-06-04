const multer = require('multer');
const path = require('path');

/**
 * Multer configuration for file uploads.
 * - Stores files in 'uploads/' directory
 * - Filenames are prefixed with timestamp to avoid collisions
 * - Only .pdf and .docx files are accepted
 * - Max file size: 10MB
 */

// Configure disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Prefix with timestamp to avoid name collisions
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

// Filter: only allow PDF and DOCX files
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pdf', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .pdf and .docx files are allowed'), false);
  }
};

// Create and export configured multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

module.exports = upload;
