const mongoose = require('mongoose');

const ModerationFlagSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    }, // e.g., "Custom reason chip on GBP/JPY flagged as spam"
    subtitle: { 
        type: String, 
        required: true 
    }, // e.g., "Reported by 4 users · submitted by trader 'fx_ghost99'"
    type: { 
        type: String, 
        enum: ['CUSTOM_CHIP_SPAM', 'VOTE_VELOCITY', 'LEADERBOARD_DISPUTE', 'OTHER'], 
        required: true 
    },
    targetUser: { 
        type: String 
    },
    targetResource: { 
        type: String 
    },
    status: { 
        type: String, 
        enum: ['PENDING', 'DISMISSED', 'REMOVED', 'INVESTIGATING', 'RESOLVED'], 
        default: 'PENDING' 
    },
    reportedCount: { 
        type: Number, 
        default: 1 
    }
}, { timestamps: true });

module.exports = mongoose.model('ModerationFlag', ModerationFlagSchema);