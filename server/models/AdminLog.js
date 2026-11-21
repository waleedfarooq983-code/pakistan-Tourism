/**
 * Admin Audit Log Model
 */
import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema({
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    adminEmail: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true
    },
    target: {
        type: String,
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ip: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

adminLogSchema.index({ createdAt: -1 });

const AdminLog = mongoose.model('AdminLog', adminLogSchema);
export default AdminLog;
