/**
 * Application Logger & Admin Audit Trail Logger
 */
import mongoose from 'express';

export const logger = {
    info: (msg, meta = {}) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? meta : '');
    },
    warn: (msg, meta = {}) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? meta : '');
    },
    error: (msg, err = {}) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, err);
    },
    adminAction: (adminEmail, action, target, details = {}) => {
        const logEntry = {
            timestamp: new Date().toISOString(),
            adminEmail,
            action,
            target,
            details
        };
        console.log(`[AUDIT - ADMIN ACTION]`, JSON.stringify(logEntry, null, 2));
    }
};

export default logger;
