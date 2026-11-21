/**
 * Cloudinary File Upload Configuration
 */
import { v2 as cloudinary } from 'cloudinary';

const isConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (isConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
    console.log('[Cloudinary] Configured successfully for uploads.');
} else {
    console.warn('[Cloudinary] Missing credentials in .env. Uploads will run in mock/local fallback mode.');
}

export { cloudinary, isConfigured };
export default cloudinary;
