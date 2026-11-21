/**
 * Tours Routes (/api/tours)
 */
import express from 'express';
import { z } from 'zod';
import Tour from '../models/Tour.js';
import AdminLog from '../models/AdminLog.js';
import { verifyJWT, requireAdmin } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import logger from '../utils/logger.js';

const router = express.Router();

const tourSchema = z.object({
    body: z.object({
        id: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug id must be lowercase letters, numbers, and hyphens'),
        title: z.string().min(3).max(120),
        destinationId: z.string().min(2).max(50),
        region: z.string().min(2).max(100),
        duration: z.string().min(2),
        durationDays: z.number().min(1),
        price: z.number().min(0),
        oldPrice: z.number().optional().nullable(),
        type: z.string().min(2),
        difficulty: z.enum(['Easy', 'Moderate', 'Challenging', 'Strenuous']).optional().default('Moderate'),
        groupSize: z.string().optional().default('2-12 people'),
        rating: z.number().min(0).max(5).optional().default(5.0),
        reviews: z.number().min(0).optional().default(0),
        image: z.string().url('Image must be a valid URL'),
        gallery: z.array(z.string().url()).optional().default([]),
        summary: z.string().min(10),
        highlights: z.array(z.string()).optional().default([]),
        includes: z.array(z.string()).optional().default([]),
        excludes: z.array(z.string()).optional().default([]),
        itinerary: z.array(z.object({
            day: z.number(),
            title: z.string(),
            desc: z.string()
        })).optional().default([]),
        featured: z.boolean().optional().default(false),
        isActive: z.boolean().optional().default(true)
    })
});

/**
 * @route   GET /api/tours
 * @desc    Get all tours with rich filtering, searching, and sorting
 */
router.get('/', async (req, res, next) => {
    try {
        const {
            type,
            region,
            destination,
            destinationId,
            minPrice,
            maxPrice,
            search,
            sort,
            featured
        } = req.query;

        const query = { isActive: true };

        if (type) {
            query.type = new RegExp(`^${type}$`, 'i');
        }

        if (region) {
            query.region = new RegExp(`^${region}$`, 'i');
        }

        const destFilter = destination || destinationId;
        if (destFilter) {
            query.destinationId = destFilter.toLowerCase();
        }

        if (featured !== undefined) {
            query.featured = featured === 'true';
        }

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { title: regex },
                { summary: regex },
                { region: regex },
                { destinationId: regex },
                { highlights: regex }
            ];
        }

        let sortOption = { featured: -1, rating: -1, createdAt: -1 };
        if (sort === 'price-asc') sortOption = { price: 1 };
        if (sort === 'price-desc') sortOption = { price: -1 };
        if (sort === 'rating') sortOption = { rating: -1 };
        if (sort === 'duration') sortOption = { durationDays: 1 };

        const tours = await Tour.find(query).sort(sortOption);

        res.status(200).json({
            success: true,
            count: tours.length,
            data: tours
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   GET /api/tours/:id
 * @desc    Get single tour by slug ID
 */
router.get('/:id', async (req, res, next) => {
    try {
        const tour = await Tour.findOne({ id: req.params.id.toLowerCase() });
        if (!tour) {
            return res.status(404).json({
                success: false,
                message: `Tour '${req.params.id}' not found.`
            });
        }
        res.status(200).json({
            success: true,
            data: tour
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/tours
 * @desc    Admin: Create new tour package
 */
router.post('/', verifyJWT, requireAdmin, validate(tourSchema), async (req, res, next) => {
    try {
        const existing = await Tour.findOne({ id: req.body.id.toLowerCase() });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Tour with slug '${req.body.id}' already exists.`
            });
        }

        const tour = await Tour.create(req.body);

        logger.adminAction(req.user.email, 'CREATE_TOUR', tour.id, { title: tour.title });
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action: 'CREATE_TOUR',
            target: tour.id,
            details: { title: tour.title }
        });

        res.status(201).json({
            success: true,
            message: 'Tour package created successfully.',
            data: tour
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   PUT /api/tours/:id
 * @desc    Admin: Update tour package
 */
router.put('/:id', verifyJWT, requireAdmin, async (req, res, next) => {
    try {
        const tour = await Tour.findOneAndUpdate(
            { id: req.params.id.toLowerCase() },
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!tour) {
            return res.status(404).json({
                success: false,
                message: `Tour '${req.params.id}' not found.`
            });
        }

        logger.adminAction(req.user.email, 'UPDATE_TOUR', tour.id);
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action: 'UPDATE_TOUR',
            target: tour.id
        });

        res.status(200).json({
            success: true,
            message: 'Tour updated successfully.',
            data: tour
        });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   DELETE /api/tours/:id
 * @desc    Admin: Delete tour package
 */
router.delete('/:id', verifyJWT, requireAdmin, async (req, res, next) => {
    try {
        const tour = await Tour.findOneAndDelete({ id: req.params.id.toLowerCase() });
        if (!tour) {
            return res.status(404).json({
                success: false,
                message: `Tour '${req.params.id}' not found.`
            });
        }

        logger.adminAction(req.user.email, 'DELETE_TOUR', req.params.id);
        await AdminLog.create({
            adminId: req.user._id,
            adminEmail: req.user.email,
            action: 'DELETE_TOUR',
            target: req.params.id
        });

        res.status(200).json({
            success: true,
            message: `Tour '${req.params.id}' deleted successfully.`
        });
    } catch (err) {
        next(err);
    }
});

export default router;
