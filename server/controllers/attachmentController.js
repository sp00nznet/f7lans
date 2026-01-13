// Chat Attachments Controller
// Handles image and file uploads for chat messages

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/attachments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration for attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}-${Date.now()}${ext}`);
  }
});

// File filter - only allow images and GIFs
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5 // Max 5 files per upload
  }
});

// Upload middleware
const uploadMiddleware = upload.array('files', 5);

// Handle file upload
const uploadFiles = async (req, res) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files. Maximum is 5 files per message.' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const attachments = req.files.map(file => {
      // Determine attachment type
      let type = 'file';
      if (file.mimetype.startsWith('image/')) {
        type = file.mimetype === 'image/gif' ? 'image' : 'image';
      }

      return {
        type,
        url: `/uploads/attachments/${file.filename}`,
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype
      };
    });

    res.json({
      success: true,
      attachments
    });
  });
};

// Delete attachment (cleanup)
const deleteAttachment = async (req, res) => {
  try {
    const { filename } = req.params;

    // Security: only allow deletion of files in attachments directory
    const filepath = path.join(uploadDir, path.basename(filename));

    if (!filepath.startsWith(uploadDir)) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      res.json({ success: true, message: 'File deleted' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

module.exports = {
  uploadFiles,
  deleteAttachment
};
