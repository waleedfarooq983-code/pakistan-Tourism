/**
 * Authentication Routes (/api/auth)
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import otpService from '../services/otpService.js';
import { verifyJWT } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimit.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper to generate access and refresh tokens
const generateTokens = (user) => {
    const accessSecret = process.env.JWT_ACCESS_SECRET || 'discover_pakistan_jwt_access_super_secret_key_2026_change_in_production';
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'discover_pakistan_jwt_refresh_super_secret_key_2026_change_in_production';

    const accessToken = jwt.sign(
        { id: user._id, role: user.role, email: user.email },
        accessSecret,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
    );

    const refreshToken = jwt.sign(
        { id: user._id },
        refreshSecret,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    return { accessToken, refreshToken };
};

// Set refresh token in httpOnly cookie
const setRefreshTokenCookie = (res, token) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
};

/* -------------------------------------------------------------
   VALIDATION SCHEMAS
------------------------------------------------------------- */
const signupSchema = z.object({
    body: z.object({
        name: z.string()
            .min(3, 'Name must be at least 3 characters')
            .max(50, 'Name cannot exceed 50 characters')
            .regex(/^[a-zA-Z\s]+$/, 'Name can only contain alphabets and spaces'),
        email: z.string()
            .email('Please enter a valid email address')
            .max(100, 'Email cannot exceed 100 characters'),
        phone: z.string()
            .regex(/^03\d{9}$/, 'Phone must be an 11-digit Pakistani number starting with 03'),
        password: z.string()
            .min(8, 'Password must be at least 8 characters')
            .max(64, 'Password cannot exceed 64 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
            .regex(/\d/, 'Password must contain at least one digit')
            .regex(/[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?`~]/, 'Password must contain at least one special character')
    })
});

const verifyOtpSchema = z.object({
    body: z.object({
        email: z.string().email('Valid email is required'),
        code: z.string().length(6, 'OTP must be exactly 6 digits'),
        purpose: z.enum(['signup', 'login', 'reset']).default('signup'),
        name: z.string().optional(),
        phone: z.string().optional(),
        password: z.string().optional()
    })
});

const loginSchema = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address'),
        password: z.string().min(1, 'Password is required')
    })
});

const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email('Valid email is required')
    })
});

const resetPasswordSchema = z.object({
    body: z.object({
        email: z.string().email('Valid email is required'),
        code: z.string().length(6, 'OTP must be exactly 6 digits'),
        newPassword: z.string()
            .min(8, 'Password must be at least 8 characters')
            .max(64, 'Password cannot exceed 64 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
            .regex(/\d/, 'Password must contain at least one digit')
            .regex(/[!@#$%^&*()_\-+=\[\]{};':"\\|,.<>\/?`~]/, 'Password must contain at least one special character')
    })
});

const updateMeSchema = z.object({
    body: z.object({
        name: z.string().min(3).max(50).regex(/^[a-zA-Z\s]+$/).optional(),
        phone: z.string().regex(/^03\d{9}$/).optional()
    })
});

/* -------------------------------------------------------------
   ENDPOINTS
------------------------------------------------------------- */

/**
 * @route   POST /api/auth/signup
 * @desc    Initiates signup by sending OTP verification
 */
router.post('/signup', authLimiter, validate(signupSchema), async (req, res, next) => {
    try {
        const { name, email, phone, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        // Check if email already registered
        const existingEmail = await User.findOne({ email: normalizedEmail });
        if (existingEmail) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email address already exists. Please login instead.'
            });
        }

        // Check if phone already registered
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            return res.status(409).json({
                success: false,
                message: 'This phone number is already registered to another account.'
            });
        }

        // Send OTP to email and phone
        const otpResult = await otpService.createAndSendOTP({
            target: normalizedEmail,
            purpose: 'signup',
            phone
        });

        console.log(`[Auth /signup] OTP generated and dispatched for ${normalizedEmail}. Code logged above.`);

        res.status(200).json({
            success: true,
            requiresOTP: true,
            email: normalizedEmail,
            phone,
            message: 'Verification code sent to your email and phone.',
            expiresInSeconds: otpResult.expiresInSeconds,
            demoCode: otpResult.demoCode,
            previewUrl: otpResult.previewUrl
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verifies OTP and finalizes user account creation
 */
router.post('/verify-otp', authLimiter, validate(verifyOtpSchema), async (req, res, next) => {
    try {
        const { email, code, purpose, name, phone, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        // 1. Verify OTP
        console.log(`[Auth /verify-otp] Verifying OTP ${code} for ${normalizedEmail} (purpose: ${purpose})...`);
        await otpService.verifyOTP({
            target: normalizedEmail,
            code,
            purpose
        });
        console.log(`[Auth /verify-otp] OTP verified successfully for ${normalizedEmail}`);

        // If purpose is signup, create the user account
        if (purpose === 'signup') {
            if (!name || !password || !phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Name, phone, and password are required to complete signup.'
                });
            }

            // Check duplicate once more
            const existing = await User.findOne({ email: normalizedEmail });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: 'Account already created. Please login.'
                });
            }

            const passwordHash = await User.hashPassword(password);
            const user = await User.create({
                name,
                email: normalizedEmail,
                phone,
                passwordHash,
                role: 'user',
                emailVerified: true,
                isActive: true,
                lastLoginAt: new Date()
            });

            const { accessToken, refreshToken } = generateTokens(user);
            setRefreshTokenCookie(res, refreshToken);

            logger.info(`[Auth] User registered successfully: ${user.email}`);

            return res.status(201).json({
                success: true,
                message: 'Account verified and created successfully!',
                accessToken,
                refreshToken,
                user: user.toJSON()
            });
        }

        // Purpose is login or reset
        res.status(200).json({
            success: true,
            message: 'OTP verified successfully.'
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/auth/resend-otp
 * @desc    Resends OTP code
 */
router.post('/resend-otp', otpLimiter, async (req, res, next) => {
    try {
        const { email, purpose = 'signup', phone } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email address is required.' });
        }

        const otpResult = await otpService.createAndSendOTP({
            target: email.toLowerCase().trim(),
            purpose,
            phone
        });

        res.status(200).json({
            success: true,
            message: 'A new verification code has been dispatched.',
            demoCode: otpResult.demoCode,
            previewUrl: otpResult.previewUrl
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticates user and returns JWT tokens
 */
router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact support.'
            });
        }

        user.lastLoginAt = new Date();
        await user.save();

        const { accessToken, refreshToken } = generateTokens(user);
        setRefreshTokenCookie(res, refreshToken);

        logger.info(`[Auth] User logged in: ${user.email} (${user.role})`);

        res.status(200).json({
            success: true,
            message: 'Logged in successfully!',
            accessToken,
            refreshToken,
            user: user.toJSON()
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/auth/social-login
 * @desc    Sign in or create account via Google or Facebook
 * @access  Public
 */
router.post('/social-login', authLimiter, async (req, res, next) => {
    try {
        const { provider, email, name, avatar, providerId } = req.body;

        if (!provider || !['google', 'facebook'].includes(provider.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Valid social provider (google or facebook) is required.'
            });
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'A valid email address is required from your social account.'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();
        let user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            const displayName = (name || (provider.toLowerCase() === 'google' ? 'Google Traveler' : 'Facebook Traveler')).trim().slice(0, 50);
            user = await User.create({
                name: displayName,
                email: normalizedEmail,
                authProvider: provider.toLowerCase(),
                providerId: providerId || `${provider.toLowerCase()}_${Date.now()}`,
                avatar: avatar || null,
                emailVerified: true,
                role: 'user',
                isActive: true,
                lastLoginAt: new Date()
            });
            logger.info(`[Auth] Registered new user via ${provider}: ${user.email}`);
        } else {
            if (!user.isActive) {
                return res.status(403).json({
                    success: false,
                    message: 'Your account has been deactivated. Please contact support.'
                });
            }
            user.lastLoginAt = new Date();
            if (avatar && !user.avatar) user.avatar = avatar;
            if (!user.authProvider || user.authProvider === 'local') {
                user.authProvider = provider.toLowerCase();
            }
            await user.save();
            logger.info(`[Auth] User logged in via ${provider}: ${user.email}`);
        }

        const { accessToken, refreshToken } = generateTokens(user);
        setRefreshTokenCookie(res, refreshToken);

        res.status(200).json({
            success: true,
            message: `Signed in successfully with ${provider.toLowerCase() === 'google' ? 'Google' : 'Facebook'}!`,
            accessToken,
            refreshToken,
            user: user.toJSON()
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refreshes access token using refresh token
 */
router.post('/refresh', async (req, res, next) => {
    try {
        const token = req.body.refreshToken || req.cookies?.refreshToken;
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token required.'
            });
        }

        const refreshSecret = process.env.JWT_REFRESH_SECRET || 'discover_pakistan_jwt_refresh_super_secret_key_2026_change_in_production';
        const decoded = jwt.verify(token, refreshSecret);

        const user = await User.findById(decoded.id);
        if (!user || !user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh session.'
            });
        }

        const tokens = generateTokens(user);
        setRefreshTokenCookie(res, tokens.refreshToken);

        res.status(200).json({
            success: true,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });
    } catch (err) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token.'
        });
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logs user out by clearing cookie
 */
router.post('/logout', (req, res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    res.status(200).json({
        success: true,
        message: 'Logged out successfully.'
    });
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Sends password reset code via email
 */
router.post('/forgot-password', otpLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
    try {
        const { email } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            // For security, do not disclose whether user exists or not
            return res.status(200).json({
                success: true,
                message: 'If an account with that email exists, a password reset code has been sent.'
            });
        }

        const otpResult = await otpService.createAndSendOTP({
            target: normalizedEmail,
            purpose: 'reset',
            phone: user.phone
        });

        res.status(200).json({
            success: true,
            message: 'If an account with that email exists, a password reset code has been sent.',
            demoCode: otpResult.demoCode,
            previewUrl: otpResult.previewUrl
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Resets password after verifying OTP
 */
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), async (req, res, next) => {
    try {
        const { email, code, newPassword } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        await otpService.verifyOTP({
            target: normalizedEmail,
            code,
            purpose: 'reset'
        });

        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        user.passwordHash = await User.hashPassword(newPassword);
        await user.save();

        logger.info(`[Auth] Password successfully reset for ${user.email}`);

        res.status(200).json({
            success: true,
            message: 'Password reset successful. You may now log in with your new password.'
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/auth/me
 * @desc    Returns current logged in user details
 */
router.get('/me', verifyJWT, async (req, res) => {
    res.status(200).json({
        success: true,
        user: req.user.toJSON()
    });
});

/**
 * @route   PATCH /api/auth/me
 * @desc    Update current user profile
 */
router.patch('/me', verifyJWT, validate(updateMeSchema), async (req, res, next) => {
    try {
        const { name, phone } = req.body;
        if (name) req.user.name = name;
        if (phone) {
            const conflict = await User.findOne({ phone, _id: { $ne: req.user._id } });
            if (conflict) {
                return res.status(409).json({ success: false, message: 'Phone number already in use.' });
            }
            req.user.phone = phone;
        }

        await req.user.save();

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            user: req.user.toJSON()
        });
    } catch (err) {
        next(err);
    }
});

export default router;
