/**
 * Admin Creation Script
 * Usage: node scripts/createAdmin.js <email> <password> <name> <phone>
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.js';

const run = async () => {
    try {
        const args = process.argv.slice(2);
        const email = (args[0] || process.env.ADMIN_EMAIL || 'admin@discoverpakistan.pk').toLowerCase().trim();
        const password = args[1] || process.env.ADMIN_PASSWORD || 'admin123';
        const name = args[2] || process.env.ADMIN_NAME || 'Super Admin';
        const phone = args[3] || process.env.ADMIN_PHONE || '03001234567';

        const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/discover_pakistan';
        await mongoose.connect(mongoUri);

        let user = await User.findOne({ email });
        const passwordHash = await User.hashPassword(password);

        if (user) {
            user.role = 'admin';
            user.passwordHash = passwordHash;
            user.name = name;
            user.phone = phone;
            user.emailVerified = true;
            user.isActive = true;
            await user.save();
            console.log(`[Admin] Successfully updated existing user to admin: ${email}`);
        } else {
            user = await User.create({
                name,
                email,
                phone,
                passwordHash,
                role: 'admin',
                emailVerified: true,
                isActive: true
            });
            console.log(`[Admin] Successfully created new administrator: ${email}`);
        }

        console.log(`Email    : ${email}`);
        console.log(`Role     : ${user.role}`);
        process.exit(0);
    } catch (err) {
        console.error('[Error]:', err.message);
        process.exit(1);
    }
};

run();
