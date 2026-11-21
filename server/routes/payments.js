/**
 * Payments Routes (/api/payments)
 */
import express from 'express';
import { z } from 'zod';
import Booking from '../models/Booking.js';
import paymentService from '../services/paymentService.js';
import { verifyJWT } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import logger from '../utils/logger.js';

const router = express.Router();

const createIntentSchema = z.object({
    body: z.object({
        bookingId: z.string().min(1, 'Booking reference or ID is required'),
        method: z.enum(['card', 'jazzcash', 'bank', 'mock']).default('card')
    })
});

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create payment intent for a booking
 */
router.post('/create-intent', verifyJWT, validate(createIntentSchema), async (req, res, next) => {
    try {
        const { bookingId, method } = req.body;

        const query = bookingId.startsWith('DPK-')
            ? { reference: bookingId.toUpperCase() }
            : { _id: bookingId };

        const booking = await Booking.findOne(query);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }

        const intentResult = await paymentService.createPaymentIntent({
            booking,
            method
        });

        res.status(200).json({
            success: true,
            data: intentResult
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/payments/verify
 * @desc    Verify payment for JazzCash / EasyPaisa / Mock
 */
router.post('/verify', verifyJWT, async (req, res, next) => {
    try {
        const { bookingId, transactionId, method } = req.body;

        const query = bookingId.startsWith('DPK-')
            ? { reference: bookingId.toUpperCase() }
            : { _id: bookingId };

        const booking = await Booking.findOne(query);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }

        const result = await paymentService.verifyPayment({
            transactionId,
            method
        });

        if (result.verified) {
            booking.paymentStatus = 'paid';
            booking.status = 'confirmed';
            booking.paymentRef = result.transactionId;
            await booking.save();
        }

        res.status(200).json({
            success: true,
            message: 'Payment verified and booking confirmed.',
            data: booking
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/payments/webhook
 * @desc    Stripe Webhook Listener
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // TODO: In production with live Stripe, verify signature:
    // event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    logger.info('[Payment] Received webhook event');

    res.status(200).json({ received: true });
});

export default router;
