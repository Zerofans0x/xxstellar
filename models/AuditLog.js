const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    logId: { 
        type: String, 
        unique: true 
    },
    initiatorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    },
    initiatorName: { 
        type: String, 
        required: true 
    },
    action: { 
        type: String, 
        required: true 
    },
    category: { 
        type: String, 
        enum: ['Admin', 'Security', 'Billing', 'System', 'Course_Management', 'Auth'], 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['Success', 'Warning', 'Failed', 'Info'], 
        required: true 
    },
    metadata: { 
        type: String 
    }
}, { timestamps: true });

// Auto-generate the LOG-XXXX identifier before saving
auditLogSchema.pre('save', function(next) {
    if (!this.logId) {
        const randomString = Math.floor(1000 + Math.random() * 9000);
        const timeSlice = Date.now().toString().slice(-4);
        this.logId = `LOG-${timeSlice}${randomString}`;
    }
    next();
});

module.exports = mongoose.model('AuditLog', auditLogSchema);