/**
 * Booking Model
 */
import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
    reference: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
    },
    tourId: {
        type: String,
        required: true,
        trim: true
    },
    tour: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tour',
        default: null
    },
    tourSnapshot: {
        id: { type: String, required: true },
        title: { type: String, required: true },
        image: { type: String, required: true },
        duration: { type: String, required: true },
        region: { type: String, required: true },
        type: { type: String, required: true },
        price: { type: Number, required: true }
    },
    date: {
        type: Date,
        required: [true, 'Departure date is required'],
        index: true
    },
    adults: {
        type: Number,
        required: true,
        min: [1, 'Must have at least 1 adult traveler'],
        default: 1
    },
    children: {
        type: Number,
        default: 0,
        min: 0
    },
    total: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled', 'completed'],
        default: 'confirmed',
        index: true
    },
    customer: {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, lowercase: true, trim: true, index: true },
        phone: { type: String, required: true, trim: true },
        cnic: { type: String, default: '', trim: true },
        city: { type: String, default: '', trim: true }
    },
    requests: {
        type: String,
        default: '',
        trim: true
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'jazzcash', 'bank', 'mock'],
        default: 'card'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'paid'
    },
    paymentRef: {
        type: String,
        default: null
    },
    bookedAt: {
        type: Date,
        default: Date.now
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    cancellationReason: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Compound index for querying user's bookings by date
bookingSchema.index({ user: 1, createdAt: -1 });

bookingSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    }
});

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
