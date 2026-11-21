/**
 * Unique Booking Reference Generator
 * Format: DPK-XXXXXX (e.g. DPK-8K4F2Q)
 */
import crypto from 'crypto';

export function generateReference(prefix = 'DPK-') {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude ambiguous chars like 0, 1, I, O
    let randomPart = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
        randomPart += chars[bytes[i] % chars.length];
    }
    return `${prefix}${randomPart}`;
}

export default generateReference;
