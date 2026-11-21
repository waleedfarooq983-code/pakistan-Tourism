/**
 * Database Connection Configuration (MongoDB / Mongoose)
 */
import mongoose from 'mongoose';

export const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/discover_pakistan';
        
        // Strict query configuration to prevent NoSQL injection
        mongoose.set('strictQuery', true);

        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
        });

        console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);
        return conn;
    } catch (error) {
        console.error(`[MongoDB] Connection error: ${error.message}`);
        console.warn(`[MongoDB] Make sure your MongoDB instance or Atlas connection string in .env is valid.`);
        // In local development we do not immediately kill the process so other parts can still be inspected
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

export default connectDB;
