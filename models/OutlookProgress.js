const mongoose = require('mongoose');

const OutlookProgressSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    outlook: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'WeeklyOutlook', 
        required: true 
    },
    progressPercent: { 
        type: Number, 
        default: 0, 
        min: 0, 
        max: 100 
    },
    lastPositionSeconds: { 
        type: Number, 
        default: 0 
    },
    isCompleted: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

OutlookProgressSchema.index({ user: 1, outlook: 1 }, { unique: true });

module.exports = mongoose.model('OutlookProgress', OutlookProgressSchema);