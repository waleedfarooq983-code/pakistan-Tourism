/**
 * Upload Routes (/api/upload)
 * Uses Multer and Cloudinary
 */
import express from 'express';
import multer from 'multer';
import { cloudinary, isConfigured } from '../config/cloudinary.js';
import { verifyJWT, requireAdmin } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Memory storage for multer so we can stream directly to Cloudinary or handle locally
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, WebP) are allowed!'), false);
        }
    }
});

/**
 * @route   POST /api/upload/image
 * @desc    Admin: Upload single image to Cloudinary
 */
router.post('/image', verifyJWT, requireAdmin, upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please provide an image file to upload.' });
        }

        if (isConfigured) {
            // Upload to Cloudinary using stream
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'discover-pakistan',
                    resource_type: 'image',
                    transformation: [{ quality: 'auto', fetch_format: 'auto' }]
                },
                (error, result) => {
                    if (error) {
                        logger.error('[Upload] Cloudinary upload error:', error);
                        return res.status(500).json({ success: false, message: 'Cloudinary upload failed.' });
                    }

                    return res.status(200).json({
                        success: true,
                        url: result.secure_url,
                        publicId: result.public_id
                    });
                }
            );

            uploadStream.end(req.file.buffer);
        } else {
            // Development fallback when Cloudinary credentials are not set
            const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
            logger.warn('[Upload] Cloudinary not configured. Returning base64 data URI for demo.');
            return res.status(200).json({
                success: true,
                url: base64Data,
                note: 'Cloudinary credentials missing in .env. Returned data URI in dev mode.'
            });
        }
    } catch (err) {
        next(err);
    }
});

export default router;
