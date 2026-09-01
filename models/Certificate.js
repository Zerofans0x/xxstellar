// models/Certificate.js
const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
    certificateId: { 
        type: String, 
        unique: true 
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    course: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Course', 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['valid', 'revoked'], 
        default: 'valid' 
    },
    issuedAt: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

// Auto-generate the PSY ID format (Modern Mongoose Syntax)
CertificateSchema.pre('save', function() {
    if (!this.certificateId) {
        const dateStr = new Date().toISOString().split('T')[0];
        const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
        this.certificateId = `PSY-${dateStr}-${randomStr}`;
    }
});

module.exports = mongoose.model('Certificate', CertificateSchema);