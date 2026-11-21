/**
 * Bookings Routes (/api/bookings)
 */
import express from 'express';
import { z } from 'zod';
import Booking from '../models/Booking.js';
import Tour from '../models/Tour.js';
import AdminLog from '../models/AdminLog.js';
import { verifyJWT, requireAdmin } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import generateReference from '../utils/generateReference.js';
import emailService from '../services/emailService.js';
import logger from '../utils/logger.js';

const router = express.Router();

const createBookingSchema = z.object({
    body: z.object({
        tourId: z.string().min(1, 'Tour ID is required'),
        date: z.string().or(z.date()),
        adults: z.number().int().min(1, 'At least 1 adult required').default(1),
        children: z.number().int().min(0).default(0),
        customer: z.object({
            name: z.string().min(2, 'Name is required'),
            email: z.string().email('Valid email is required'),
            phone: z.string().regex(/^03\d{9}$/, 'Pakistani phone number starting with 03 is required'),
            cnic: z.string().optional().default(''),
            city: z.string().optional().default('')
        }),
        requests: z.string().optional().default(''),
        paymentMethod: z.enum(['card', 'jazzcash', 'bank', 'mock']).default('card')
    })
});

const statusSchema = z.object({
    body: z.object({
        status: z.enum(['pending', 'confirmed', 'cancelled', 'completed'])
    })
});

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking (Recalculates price server-side from DB)
 */
router.post('/', verifyJWT, validate(createBookingSchema), async (req, res, next) => {
    try {
        const { tourId, date, adults, children, customer, requests, paymentMethod } = req.body;

        // 1. Fetch tour from DB
        const tour = await Tour.findOne({ id: tourId.toLowerCase() });
        if (!tour || !tour.isActive) {
            return res.status(404).json({
                success: false,
                message: 'The requested tour package could not be found or is currently inactive.'
            });
        }

        // 2. CRITICAL SECURITY: Calculate price on the server side
        // Children are charged at 60% of adult price
        const adultPrice = tour.price;
        const childPrice = Math.round(tour.price * 0.6);
        const calculatedTotal = (adults * adultPrice) + (children * childPrice);

        // 3. Generate unique reference e.g. DPK-XXXXXX
        let reference = generateReference();
        while (await Booking.findOne({ reference })) {
            reference = generateReference();
        }

        // 4. Create snapshot
        const tourSnapshot = {
            id: tour.id,
            title: tour.title,
            image: tour.image,
            duration: tour.duration,
            region: tour.region,
            type: tour.type,
            price: tour.price
        };

        const booking = await Booking.create({
            reference,
            user: req.user._id,
            tourId: tour.id,
            tour: tour._id,
            tourSnapshot,
            date: new Date(date),
            adults,
            children,
            total: calculatedTotal,
            status: 'confirmed',
            customer,
            requests,
            paymentMethod,
            paymentStatus: 'paid',
            paymentRef: `PAY-${Date.now().toString(36).toUpperCase()}`,
            bookedAt: new Date()
        });

        logger.info(`[Booking] Created: ${booking.reference} for ${customer.name} ($${calculatedTotal})`);

        // Send email confirmation asynchronously
        emailService.sendBookingConfirmation(booking).catch(err => {
            logger.error(`[Booking] Email confirmation error: ${err.message}`);
        });

        res.status(201).json({
            success: true,
            message: 'Booking created and confirmed successfully!',
            data: booking
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/bookings/my
 * @desc    Get logged in user's bookings
 */
router.get('/my', verifyJWT, async (req, res, next) => {
    try {
        const bookings = await Booking.find({
            $or: [
                { user: req.user._id },
                { 'customer.email': req.user.email.toLowerCase() }
            ]
        }).sort({ bookedAt: -1, createdAt: -1 });

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/bookings/:id
 * @desc    Get single booking (owner or admin)
 */
router.get('/:id', verifyJWT, async (req, res, next) => {
    try {
        const query = req.params.id.startsWith('DPK-')
            ? { reference: req.params.id.toUpperCase() }
            : { _id: req.params.id };

        const booking = await Booking.findOne(query);

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found.'
            });
        }

        // Access check: must be owner or admin
        const isOwner = (booking.user && booking.user.toString() === req.user._id.toString()) ||
                        (booking.customer.email.toLowerCase() === req.user.email.toLowerCase());
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized to view this booking.'
            });
        }

        res.status(200).json({
            success: true,
            data: booking
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   PATCH /api/bookings/:id/cancel
 * @desc    Cancel booking by owner (within 7 days of departure/booking)
 */
router.patch('/:id/cancel', verifyJWT, async (req, res, next) => {
    try {
        const query = req.params.id.startsWith('DPK-')
            ? { reference: req.params.id.toUpperCase() }
            : { _id: req.params.id };

        const booking = await Booking.findOne(query);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }

        const isOwner = (booking.user && booking.user.toString() === req.user._id.toString()) ||
                        (booking.customer.email.toLowerCase() === req.user.email.toLowerCase());
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Unauthorized.' });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({ success: false, message: 'Booking is already cancelled.' });
        }

        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancellationReason = req.body.reason || 'Cancelled by customer';
        await booking.save();

        logger.info(`[Booking] Cancelled: ${booking.reference}`);

        res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully.',
            data: booking
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/bookings
 * @desc    Admin: List all bookings with search, status filter, and pagination
 */
router.get('/', verifyJWT, requireAdmin, async (req, res, next) => {
    try {
        const { search, status, page = 1, limit = 50 } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { reference: regex },
                { 'customer.name': regex },
                { 'customer.email': regex },
                { 'customer.phone': regex },
                { 'tourSnapshot.title': regex }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Booking.countDocuments(query);
        const bookings = await Booking.find(query)
            .sort({ bookedAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            count: bookings.length,
            data: bookings
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   PATCH /api/bookings/:id/status
 * @desc    Admin: Update status (confirm/cancel/complete)
 */
router.patch('/:id/status', verifyJWT, requireAdmin, validate(statusSchema), async (req, res, next) => {
    try {
        const query = req.params.id.startsWith('DPK-')
            ? { reference: req.params.id.toUpperCase() }
            : { _id: req.params.id };

        const booking = await Booking.findOne(query);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }

        booking.status = req.body.status;
        if (req.body.status === 'cancelled') {
            booking.cancelledAt = new Date();
        }
        await booking.save();

        logger.adminAction(req.user.email, 'UPDATE_BOOKING_STATUS', booking.reference, { status: booking.status });
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action: 'UPDATE_BOOKING_STATUS',
            target: booking.reference,
            details: { status: booking.status }
        });

        res.status(200).json({
            success: true,
            message: `Booking status updated to ${booking.status}.`,
            data: booking
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   DELETE /api/bookings/:id
 * @desc    Admin: Delete booking
 */
router.delete('/:id', verifyJWT, requireAdmin, async (req, res, next) => {
    try {
        const query = req.params.id.startsWith('DPK-')
            ? { reference: req.params.id.toUpperCase() }
            : { _id: req.params.id };

        const booking = await Booking.findOneAndDelete(query);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }

        logger.adminAction(req.user.email, 'DELETE_BOOKING', booking.reference);
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action: 'DELETE_BOOKING',
            target: booking.reference
        });

        res.status(200).json({
            success: true,
            message: `Booking ${booking.reference} deleted successfully.`
        });
    } catch (err) {
        next(err);
    }
});

export default router;
