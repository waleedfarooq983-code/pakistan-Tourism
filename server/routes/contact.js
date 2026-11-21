/**
 * Contact Form Routes (/api/contact)
 */
import express from 'express';
import { z } from 'zod';
import Message from '../models/Message.js';
import emailService from '../services/emailService.js';
import { verifyJWT, requireAdmin } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import logger from '../utils/logger.js';

const router = express.Router();

const contactSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'Name is required').max(100),
        email: z.string().email('Please enter a valid email address'),
        phone: z.string().optional().default(''),
        subject: z.string().min(2, 'Subject is required').max(200),
        message: z.string().min(5, 'Message must be at least 5 characters').max(3000)
    })
});

/**
 * @route   POST /api/contact
 * @desc    Public: Submit contact message
 */
router.post('/', validate(contactSchema), async (req, res, next) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        const record = await Message.create({
            name,
            email,
            phone,
            subject,
            message
        });

        // Email admin notification in background
        emailService.sendAdminContactNotification(record).catch(e => {
            logger.error(`[Contact] Failed to send admin email: ${e.message}`);
        });

        res.status(201).json({
            success: true,
            message: 'Your message has been sent successfully. We will contact you shortly!',
            data: record
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/contact
 * @desc    Admin: List contact messages
 */
router.get('/', verifyJWT, requireAdmin, async (req, res, next) => {
    try {
        const messages = await Message.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: messages.length,
            data: messages
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   PATCH /api/contact/:id/read
 * @desc    Admin: Mark message as read
 */
router.patch('/:id/read', verifyJWT, requireAdmin, async (req, res, next) => {
    try {
        const message = await Message.findByIdAndUpdate(
            req.params.id,
            { isRead: true },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found.' });
        }

        res.status(200).json({
            success: true,
            message: 'Message marked as read.',
            data: message
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   DELETE /api/contact/:id
 * @desc    Admin: Delete message
 */
router.delete('/:id', verifyJWT, requireAdmin, async (req, res, next) => {
    try {
        const message = await Message.findByIdAndDelete(req.params.id);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found.' });
        }

        res.status(200).json({
            success: true,
            message: 'Message deleted successfully.'
        });
    } catch (err) {
        next(err);
    }
});

export default router;
