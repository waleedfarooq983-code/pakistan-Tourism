/**
 * Tour Package Model
 */
import mongoose from 'mongoose';

const itineraryItemSchema = new mongoose.Schema({
    day: { type: Number, required: true },
    title: { type: String, required: true },
    desc: { type: String, required: true }
}, { _id: false });

const tourSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    destinationId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    region: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    duration: {
        type: String,
        required: true
    },
    durationDays: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    oldPrice: {
        type: Number,
        default: null
    },
    type: {
        type: String,
        required: true,
        index: true
    },
    difficulty: {
        type: String,
        enum: ['Easy', 'Moderate', 'Challenging', 'Strenuous'],
        default: 'Moderate'
    },
    groupSize: {
        type: String,
        default: '2-12 people'
    },
    rating: {
        type: Number,
        default: 4.9,
        min: 0,
        max: 5
    },
    reviews: {
        type: Number,
        default: 0
    },
    image: {
        type: String,
        required: true
    },
    gallery: {
        type: [String],
        default: []
    },
    summary: {
        type: String,
        required: true
    },
    highlights: {
        type: [String],
        default: []
    },
    includes: {
        type: [String],
        default: []
    },
    excludes: {
        type: [String],
        default: []
    },
    itinerary: [itineraryItemSchema],
    featured: {
        type: Boolean,
        default: false,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true
});

tourSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    }
});

const Tour = mongoose.model('Tour', tourSchema);
export default Tour;
