/**
 * Newsletter Routes (/api/newsletter)
 */
import express from 'express';
import { z } from 'zod';
import Newsletter from '../models/Newsletter.js';
import validate from '../middleware/validate.js';

const router = express.Router();

const newsletterSchema = z.object({
    body: z.object({
        email: z.string().email('Please enter a valid email address')
    })
});

/**
 * @route   POST /api/newsletter/subscribe
 * @desc    Subscribe an email to the newsletter
 */
router.post('/subscribe', validate(newsletterSchema), async (req, res, next) => {
    try {
        const email = req.body.email.toLowerCase().trim();

        const existing = await Newsletter.findOne({ email });
        if (existing) {
            if (!existing.isActive) {
                existing.isActive = true;
                await existing.save();
            }
            return res.status(200).json({
                success: true,
                message: 'You are subscribed to the Discover Pakistan newsletter!'
            });
        }

        await Newsletter.create({ email });

        res.status(201).json({
            success: true,
            message: 'Thank you for subscribing! Check your inbox for upcoming travel deals.'
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/newsletter/unsubscribe
 * @desc    Unsubscribe an email
 */
router.post('/unsubscribe', validate(newsletterSchema), async (req, res, next) => {
    try {
        const email = req.body.email.toLowerCase().trim();
        await Newsletter.findOneAndUpdate({ email }, { isActive: false });

        res.status(200).json({
            success: true,
            message: 'You have been unsubscribed from newsletter updates.'
        });
    } catch (err) {
        next(err);
    }
});

export default router;
