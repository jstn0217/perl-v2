import type { RequestHandler } from 'express';
import multer from 'multer';

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (allowedImageTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }

    callback(new Error('Only JPEG, PNG, and WebP images are allowed.'));
  }
});

export const uploadSingleImage: RequestHandler = (req, res, next) => {
  upload.single('image')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    const message = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
      ? 'Image must be 5 MB or smaller.'
      : error instanceof Error
        ? error.message
        : 'Unable to read image upload.';

    res.status(400).json({ message });
  });
};
