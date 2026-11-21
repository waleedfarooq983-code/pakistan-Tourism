/**
 * User Model
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [3, 'Name must be at least 3 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
    },
    phone: {
        type: String,
        required: function () {
            return this.authProvider === 'local' || !this.authProvider;
        },
        sparse: true,
        trim: true,
        match: [/^03\d{9}$/, 'Phone must be an 11-digit Pakistani number starting with 03']
    },
    passwordHash: {
        type: String,
        required: function () {
            return this.authProvider === 'local' || !this.authProvider;
        }
    },
    authProvider: {
        type: String,
        enum: ['local', 'google', 'facebook'],
        default: 'local'
    },
    providerId: {
        type: String,
        default: null
    },
    avatar: {
        type: String,
        default: null
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLoginAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Helper instance method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.passwordHash) return false;
    return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash passwords with 12 rounds
userSchema.statics.hashPassword = async function (plainPassword) {
    return bcrypt.hash(plainPassword, 12);
};

// Transform to remove sensitive information on JSON serialization
userSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
    }
});

const User = mongoose.model('User', userSchema);
export default User;
