const mongoose = require('mongoose');

const WeeklyOutlookSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    }, // e.g., "Third week of July"
    speaker: { 
        type: String, 
        required: true, 
        default: 'Emrld' 
    }, // e.g., "Alubarika", "Bella", "Emrld"
    month: { 
        type: String, 
        required: true 
    }, // e.g., "July"
    year: { 
        type: Number, 
        required: true, 
        default: new Date().getFullYear() 
    },
    weekNumber: { 
        type: Number 
    }, // e.g., 3 (for 3rd week)
    thumbnailUrl: { 
        type: String, 
        required: true 
    },
    videoUrl: { 
        type: String, 
        required: true 
    }, // Stream URL (Cloudflare Stream, Vimeo, HLS, or S3)
    durationMinutes: { 
        type: Number, 
        required: true, 
        default: 15 
    },
    overview: { 
        type: String, 
        required: true 
    }, // Summary text under player
    isFeatured: { 
        type: Boolean, 
        default: false 
    }, // Shows as the large Hero card on the right
    isPublished: { 
        type: Boolean, 
        default: true 
    },
    publishedAt: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

// Ensure only one hero/featured video exists at a time (optional helper index)
WeeklyOutlookSchema.index({ publishedAt: -1 });

module.exports = mongoose.model('WeeklyOutlook', WeeklyOutlookSchema);