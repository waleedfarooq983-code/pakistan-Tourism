/**
 * Central Error Handling Middleware
 */
import logger from '../utils/logger.js';

export const notFound = (req, res, next) => {
    const error = new Error(`Resource not found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

export const errorHandler = (err, req, res, next) => {
    let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    let message = err.message || 'Internal Server Error';

    // Log the error
    logger.error(`${req.method} ${req.originalUrl} - ${message}`, err.stack);

    // Mongoose CastError (e.g., bad ObjectId)
    if (err.name === 'CastError') {
        statusCode = 404;
        message = `Resource not found for value ${err.value}`;
    }

    // Mongoose Duplicate Key Error (e.g., duplicate email)
    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        message = `An entry with this ${field} already exists.`;
    }

    // Mongoose Validation Error
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors).map(val => val.message).join(', ');
    }

    // JWT Errors
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid authentication token';
    }

    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
};

export default { notFound, errorHandler };
