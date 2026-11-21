/**
 * Authentication and Authorization Middleware
 */
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const verifyJWT = async (req, res, next) => {
    try {
        let token = null;

        // 1. Check Authorization Bearer header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }

        // 2. Check cookies fallback
        if (!token && req.cookies && req.cookies.accessToken) {
            token = req.cookies.accessToken;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. No token provided.'
            });
        }

        const secret = process.env.JWT_ACCESS_SECRET || 'discover_pakistan_jwt_access_super_secret_key_2026_change_in_production';
        const decoded = jwt.verify(token, secret);

        const user = await User.findById(decoded.id).select('-passwordHash');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid session. User not found.'
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Account has been deactivated. Please contact support.'
            });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Session expired. Please refresh token or login again.',
                code: 'TOKEN_EXPIRED'
            });
        }
        return res.status(401).json({
            success: false,
            message: 'Invalid authorization token.'
        });
    }
};

export const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied: Administrator privileges required.'
        });
    }
    next();
};

export const optionalAuth = async (req, res, next) => {
    try {
        let token = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (req.cookies && req.cookies.accessToken) {
            token = req.cookies.accessToken;
        }

        if (token) {
            const secret = process.env.JWT_ACCESS_SECRET || 'discover_pakistan_jwt_access_super_secret_key_2026_change_in_production';
            const decoded = jwt.verify(token, secret);
            const user = await User.findById(decoded.id).select('-passwordHash');
            if (user && user.isActive) {
                req.user = user;
            }
        }
    } catch {
        // Silently continue for optional auth
    }
    next();
};

export default { verifyJWT, requireAdmin, optionalAuth };
