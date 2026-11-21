/**
 * One-Time Password (OTP) Model
 * Includes hashed code, attempt counting, purpose, and automatic TTL expiry
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const otpSchema = new mongoose.Schema({
    target: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    codeHash: {
        type: String,
        required: true
    },
    purpose: {
        type: String,
        enum: ['signup', 'login', 'reset'],
        required: true
    },
    attempts: {
        type: Number,
        default: 0
    },
    verified: {
        type: Boolean,
        default: false
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // MongoDB TTL index: document automatically deleted when expiresAt arrives
    }
}, {
    timestamps: true
});

otpSchema.methods.compareCode = async function (enteredCode) {
    return bcrypt.compare(enteredCode, this.codeHash);
};

otpSchema.statics.hashCode = async function (plainCode) {
    return bcrypt.hash(plainCode, 10);
};

const OTP = mongoose.model('OTP', otpSchema);
export default OTP;
