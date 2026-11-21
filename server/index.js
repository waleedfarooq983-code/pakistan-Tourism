/**
 * Discover Pakistan - Backend Application Server
 */
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDir = path.resolve(__dirname, '../');

// Load environment variables before any other imports
dotenv.config();

import connectDB from './config/db.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';

// Route handlers
import authRoutes from './routes/auth.js';
import destinationRoutes from './routes/destinations.js';
import tourRoutes from './routes/tours.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import contactRoutes from './routes/contact.js';
import newsletterRoutes from './routes/newsletter.js';
import uploadRoutes from './routes/upload.js';
import adminRoutes from './routes/admin.js';

const app = express();

// Connect to MongoDB
connectDB();

// 1. Security Headers (Helmet)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// 2. CORS Configuration
const allowedOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map(url => url.trim())
    .filter(Boolean);

// Default development origins
const devOrigins = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        
        const allOrigins = [...allowedOrigins, ...devOrigins];
        const isAllowed = allOrigins.some(allowed => origin === allowed || origin.startsWith(allowed));
        
        if (isAllowed || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error(`CORS policy blocked access from origin: ${origin}`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 3. HTTP Request Logging (Morgan)
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// 4. Request Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 5. Apply general rate limiter
app.use('/api', apiLimiter);

// 6. Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        status: 'online',
        service: 'Discover Pakistan API',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 7. API Routes
app.use('/api/auth', authRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/tours', tourRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', adminRoutes);

// 8. Serve Frontend Static Assets
app.use(express.static(clientDir));

// Fallback to index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'));
});

// 9. Error Handlers
app.use(notFound);
app.use(errorHandler);

// 9. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`Discover Pakistan Backend Server running on port ${PORT} [NODE_ENV=${process.env.NODE_ENV || 'development'}]`);
    logger.info(`Health check available at http://localhost:${PORT}/api/health`);
});

export default app;
