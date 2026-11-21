/**
 * Destinations Routes (/api/destinations)
 */
import express from 'express';
import { z } from 'zod';
import Destination from '../models/Destination.js';
import AdminLog from '../models/AdminLog.js';
import { verifyJWT, requireAdmin } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import logger from '../utils/logger.js';

const router = express.Router();

const destinationSchema = z.object({
    body: z.object({
        id: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug id must be lowercase letters, numbers and hyphens'),
        name: z.string().min(2).max(100),
        region: z.string().min(2).max(100),
        tagline: z.string().optional().default(''),
        description: z.string().optional().default(''),
        longDescription: z.string().optional().default(''),
        heroImage: z.string().url('Hero image must be a valid URL'),
        gallery: z.array(z.string().url()).optional().default([]),
        coords: z.array(z.number()).length(2).optional().default([0, 0]),
        altitude: z.string().optional().default(''),
        bestTime: z.string().optional().default(''),
        temperature: z.string().optional().default(''),
        howToReach: z.string().optional().default(''),
        highlights: z.array(z.string()).optional().default([]),
        culture: z.string().optional().default(''),
        food: z.array(z.object({ name: z.string(), desc: z.string() })).optional().default([]),
        activities: z.array(z.object({ name: z.string(), icon: z.string(), desc: z.string() })).optional().default([]),
        travelTips: z.array(z.string()).optional().default([]),
        nearbyAttractions: z.array(z.object({ name: z.string(), distance: z.string() })).optional().default([]),
        weather: z.array(z.object({ month: z.string(), temp: z.string(), icon: z.string() })).optional().default([]),
        faqs: z.array(z.object({ q: z.string(), a: z.string() })).optional().default([]),
        featured: z.boolean().optional().default(false)
    })
});

/**
 * @route   GET /api/destinations
 * @desc    Get all destinations with optional filtering (?region, ?featured, ?search)
 */
router.get('/', async (req, res, next) => {
    try {
        const { region, featured, search } = req.query;
        const query = {};

        if (region) {
            query.region = new RegExp(`^${region}$`, 'i');
        }

        if (featured !== undefined) {
            query.featured = featured === 'true';
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: regex },
                { region: regex },
                { description: regex },
                { tagline: regex },
                { highlights: regex }
            ];
        }

        const destinations = await Destination.find(query).sort({ featured: -1, name: 1 });
        res.status(200).json({
            success: true,
            count: destinations.length,
            data: destinations
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/destinations/:id
 * @desc    Get single destination by slug ID
 */
router.get('/:id', async (req, res, next) => {
    try {
        const destination = await Destination.findOne({ id: req.params.id.toLowerCase() });
        if (!destination) {
            return res.status(404).json({
                success: false,
                message: `Destination '${req.params.id}' not found.`
            });
        }
        res.status(200).json({
            success: true,
            data: destination
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/destinations
 * @desc    Admin: Create new destination
 */
router.post('/', verifyJWT, requireAdmin, validate(destinationSchema), async (req, res, next) => {
    try {
        const existing = await Destination.findOne({ id: req.body.id.toLowerCase() });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Destination with slug '${req.body.id}' already exists.`
            });
        }

        const destination = await Destination.create(req.body);

        // Audit log
        logger.adminAction(req.user.email, 'CREATE_DESTINATION', destination.id, { name: destination.name });
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action: 'CREATE_DESTINATION',
            target: destination.id,
            details: { name: destination.name }
        });

        res.status(201).json({
            success: true,
            message: 'Destination created successfully.',
            data: destination
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   PUT /api/destinations/:id
 * @desc    Admin: Update destination by slug ID
 */
router.put('/:id', verifyJWT, requireAdmin, async (req, res, next) => {
    try {
        const destination = await Destination.findOneAndUpdate(
            { id: req.params.id.toLowerCase() },
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!destination) {
            return res.status(404).json({
                success: false,
                message: `Destination '${req.params.id}' not found.`
            });
        }

        logger.adminAction(req.user.email, 'UPDATE_DESTINATION', destination.id);
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action: 'UPDATE_DESTINATION',
            target: destination.id
        });

        res.status(200).json({
            success: true,
            message: 'Destination updated successfully.',
            data: destination
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   DELETE /api/destinations/:id
 * @desc    Admin: Delete destination by slug ID
 */
router.delete('/:id', verifyJWT, requireAdmin, async (req, res, next) => {
    try {
        const destination = await Destination.findOneAndDelete({ id: req.params.id.toLowerCase() });
        if (!destination) {
            return res.status(404).json({
                success: false,
                message: `Destination '${req.params.id}' not found.`
            });
        }

        logger.adminAction(req.user.email, 'DELETE_DESTINATION', req.params.id);
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action: 'DELETE_DESTINATION',
            target: req.params.id
        });

        res.status(200).json({
            success: true,
            message: `Destination '${req.params.id}' deleted successfully.`
        });
    } catch (err) {
        next(err);
    }
});

export default router;
