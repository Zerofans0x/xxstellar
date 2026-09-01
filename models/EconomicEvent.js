const mongoose = require('mongoose');

const EconomicEventSchema = new mongoose.Schema({
    eventId: { 
        type: String, 
        unique: true, 
        required: true 
    },
    title: { 
        type: String, 
        required: true 
    }, // e.g., "US Retail Sales (June)"
    currency: { 
        type: String, 
        required: true, 
        enum: ['AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'JPY', 'NZD', 'USD', 'CNY', 'ALL'] 
    },
    impact: { 
        type: String, 
        enum: ['High', 'Mid', 'Low', 'Holiday'], 
        required: true 
    },
    eventType: {
        type: String,
        enum: ['Growth', 'Inflation', 'Employment', 'Central Bank', 'Housing', 'Consumer Surveys', 'Business Surveys', 'Speeches', 'Other'],
        default: 'Other'
    },
    dateUtc: { 
        type: Date, 
        required: true 
    },
    timeString: { 
        type: String 
    }, // e.g., "3:00pm", "All Day"
    description: { 
        type: String 
    }, // e.g., "Watch Asian open for direction cues"
    
    // Standard calendar metrics (optional for your current UI, but good for future-proofing)
    actual: { type: String },
    forecast: { type: String },
    previous: { type: String },
}, { timestamps: true });

// Compound index for blazing fast UI filtering
EconomicEventSchema.index({ dateUtc: 1, impact: 1, currency: 1 });

module.exports = mongoose.model('EconomicEvent', EconomicEventSchema);