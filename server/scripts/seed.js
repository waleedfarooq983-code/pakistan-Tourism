/**
 * Database Seeder Script
 * Seeds initial Administrator, 10 Destinations, and 12 Tours from existing JSON files.
 */
import dns from 'node:dns/promises';
dns.setServers(['1.1.1.1', '8.8.8.8']);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.js';
import Destination from '../models/Destination.js';
import Tour from '../models/Tour.js';
import logger from '../utils/logger.js';

const seedDatabase = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/discover_pakistan';
        console.log(`[Seed] Connecting to MongoDB: ${mongoUri}...`);
        await mongoose.connect(mongoUri);
        console.log('[Seed] Connected successfully.');

        // 1. Locate destinations.json and tours.json
        const possibleDestPaths = [
            path.join(__dirname, '../../data/destinations.json'),
            path.join(__dirname, '../data/destinations.json'),
            path.join(process.cwd(), 'data/destinations.json')
        ];
        const possibleTourPaths = [
            path.join(__dirname, '../../data/tours.json'),
            path.join(__dirname, '../data/tours.json'),
            path.join(process.cwd(), 'data/tours.json')
        ];

        let destFilePath = possibleDestPaths.find(p => fs.existsSync(p));
        let tourFilePath = possibleTourPaths.find(p => fs.existsSync(p));

        if (!destFilePath || !tourFilePath) {
            throw new Error(`Could not find data/destinations.json or data/tours.json in project.`);
        }

        const destinationsData = JSON.parse(fs.readFileSync(destFilePath, 'utf-8'));
        const toursData = JSON.parse(fs.readFileSync(tourFilePath, 'utf-8'));

        console.log(`[Seed] Read ${destinationsData.length} destinations and ${toursData.length} tours.`);

        // 2. Seed Admin User
        const adminEmail = (process.env.ADMIN_EMAIL || 'admin@discoverpakistan.pk').toLowerCase().trim();
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const adminName = process.env.ADMIN_NAME || 'Super Admin';
        const adminPhone = process.env.ADMIN_PHONE || '03001234567';

        let adminUser = await User.findOne({ email: adminEmail });
        if (!adminUser) {
            const passwordHash = await User.hashPassword(adminPassword);
            adminUser = await User.create({
                name: adminName,
                email: adminEmail,
                phone: adminPhone,
                passwordHash,
                role: 'admin',
                emailVerified: true,
                isActive: true
            });
            console.log(`[Seed] Admin user created: ${adminEmail}`);
        } else {
            adminUser.role = 'admin';
            adminUser.passwordHash = await User.hashPassword(adminPassword);
            await adminUser.save();
            console.log(`[Seed] Admin user verified/updated: ${adminEmail}`);
        }

        // 3. Seed Destinations (Upsert by slug id)
        console.log('[Seed] Seeding destinations...');
        let destCreated = 0;
        let destUpdated = 0;

        for (const dest of destinationsData) {
            const existing = await Destination.findOne({ id: dest.id.toLowerCase() });
            if (existing) {
                await Destination.updateOne({ id: dest.id.toLowerCase() }, { $set: dest });
                destUpdated++;
            } else {
                await Destination.create(dest);
                destCreated++;
            }
        }
        console.log(`[Seed] Destinations seeded: ${destCreated} added, ${destUpdated} updated.`);

        // 4. Seed Tours (Upsert by slug id)
        console.log('[Seed] Seeding tours...');
        let toursCreated = 0;
        let toursUpdated = 0;

        for (const tour of toursData) {
            const existing = await Tour.findOne({ id: tour.id.toLowerCase() });
            if (existing) {
                await Tour.updateOne({ id: tour.id.toLowerCase() }, { $set: tour });
                toursUpdated++;
            } else {
                await Tour.create(tour);
                toursCreated++;
            }
        }
        console.log(`[Seed] Tours seeded: ${toursCreated} added, ${toursUpdated} updated.`);

        console.log('\n=============================================================');
        console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
        console.log(`Admin Email    : ${adminEmail}`);
        console.log(`Admin Password : ${adminPassword}`);
        console.log(`Destinations   : ${destinationsData.length}`);
        console.log(`Tours          : ${toursData.length}`);
        console.log('=============================================================\n');

        process.exit(0);
    } catch (err) {
        console.error('[Seed Error]:', err.message);
        process.exit(1);
    }
};

seedDatabase();
