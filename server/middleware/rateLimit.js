/**
 * Rate Limiting Middleware
 */
import rateLimit from 'express-rate-limit';

// General API rate limiter (100 requests per 15 minutes)
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes.'
    }
});

// Stricter rate limiter for authentication routes (5 requests per 15 minutes)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Generous enough for login attempts with feedback while protecting against brute force
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again in 15 minutes.'
    }
});

// Strictest rate limiter for OTP generation / resending (3 per hour per IP)
export const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 6,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many OTP requests. Please wait an hour before requesting a new code.'
    }
});

export default { apiLimiter, authLimiter, otpLimiter };
