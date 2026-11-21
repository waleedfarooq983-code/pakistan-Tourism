/**
 * Destination Model
 */
import mongoose from 'mongoose';

const foodItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    desc: { type: String, required: true }
}, { _id: false });

const activitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    icon: { type: String, default: 'fa-mountain' },
    desc: { type: String, required: true }
}, { _id: false });

const attractionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    distance: { type: String, required: true }
}, { _id: false });

const weatherSchema = new mongoose.Schema({
    month: { type: String, required: true },
    temp: { type: String, required: true },
    icon: { type: String, default: 'fa-sun' }
}, { _id: false });

const faqSchema = new mongoose.Schema({
    q: { type: String, required: true },
    a: { type: String, required: true }
}, { _id: false });

const reviewSchema = new mongoose.Schema({
    name: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    text: { type: String, required: true },
    date: { type: String, default: () => new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) }
}, { _id: false });

const destinationSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    region: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    tagline: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        default: ''
    },
    longDescription: {
        type: String,
        default: ''
    },
    heroImage: {
        type: String,
        required: true
    },
    gallery: {
        type: [String],
        default: []
    },
    coords: {
        type: [Number], // [lat, lng]
        default: [0, 0]
    },
    altitude: {
        type: String,
        default: ''
    },
    bestTime: {
        type: String,
        default: ''
    },
    temperature: {
        type: String,
        default: ''
    },
    howToReach: {
        type: String,
        default: ''
    },
    highlights: {
        type: [String],
        default: []
    },
    culture: {
        type: String,
        default: ''
    },
    food: [foodItemSchema],
    activities: [activitySchema],
    travelTips: {
        type: [String],
        default: []
    },
    nearbyAttractions: [attractionSchema],
    weather: [weatherSchema],
    faqs: [faqSchema],
    reviews: [reviewSchema],
    featured: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

// Transform output to remove __v
destinationSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    }
});

const Destination = mongoose.model('Destination', destinationSchema);
export default Destination;
