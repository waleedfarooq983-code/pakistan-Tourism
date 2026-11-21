/**
 * Admin Management Routes (/api/admin)
 */
import express from 'express';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import AdminLog from '../models/AdminLog.js';
import { verifyJWT, requireAdmin } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Protect all admin routes
router.use(verifyJWT, requireAdmin);

/**
 * @route   GET /api/admin/stats
 * @desc    Get dashboard statistics for admin panel
 */
router.get('/stats', async (req, res, next) => {
    try {
        const totalBookings = await Booking.countDocuments();
        const totalUsers = await User.countDocuments();
        
        // Sum total revenue of non-cancelled bookings
        const revenueAgg = await Booking.aggregate([
            { $match: { status: { $ne: 'cancelled' } } },
            { $group: { _id: null, total: { $sum: '$total' } } }
        ]);
        const totalRevenue = revenueAgg[0]?.total || 0;

        // Upcoming trips count
        const now = new Date();
        const upcomingTrips = await Booking.countDocuments({
            date: { $gte: now },
            status: { $ne: 'cancelled' }
        });

        // 5 most recent bookings
        const recentBookings = await Booking.find()
            .sort({ bookedAt: -1, createdAt: -1 })
            .limit(5);

        // Revenue grouped by month (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);

        const revenueByMonth = await Booking.aggregate([
            {
                $match: {
                    status: { $ne: 'cancelled' },
                    bookedAt: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$bookedAt' },
                        month: { $month: '$bookedAt' }
                    },
                    revenue: { $sum: '$total' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                totalBookings,
                totalRevenue,
                totalUsers,
                upcomingTrips,
                recentBookings,
                revenueByMonth
            }
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/admin/users
 * @desc    Paginated list of users with search
 */
router.get('/users', async (req, res, next) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const query = {};

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: regex },
                { email: regex },
                { phone: regex }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-passwordHash')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            count: users.length,
            data: users
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   PATCH /api/admin/users/:id
 * @desc    Activate / deactivate user or change role
 */
router.patch('/users/:id', async (req, res, next) => {
    try {
        const { isActive, role } = req.body;
        const update = {};
        if (isActive !== undefined) update.isActive = isActive;
        if (role !== undefined && ['user', 'admin'].includes(role)) update.role = role;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true }
        ).select('-passwordHash');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        logger.adminAction(req.user.email, 'UPDATE_USER', user.email, update);
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action: 'UPDATE_USER',
            target: user.email,
            details: update
        });

        res.status(200).json({
            success: true,
            message: 'User status updated.',
            data: user
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Delete user account
 */
router.delete('/users/:id', async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot delete your own administrative account.' });
        }

        await User.findByIdAndDelete(req.params.id);

        logger.adminAction(req.user.email, 'DELETE_USER', user.email);
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action: 'DELETE_USER',
            target: user.email
        });

        res.status(200).json({
            success: true,
            message: `User ${user.email} deleted successfully.`
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/admin/logs
 * @desc    Get admin audit logs
 */
router.get('/logs', async (req, res, next) => {
    try {
        const logs = await AdminLog.find().sort({ createdAt: -1 }).limit(100);
        res.status(200).json({
            success: true,
            count: logs.length,
            data: logs
        });
    } catch (err) {
        next(err);
    }
});

export default router;
