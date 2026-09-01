const mongoose = require('mongoose');

const BiasInstrumentSchema = new mongoose.Schema({
    symbol: { 
        type: String, 
        required: true, 
        unique: true, 
        uppercase: true 
    }, // e.g., "EUR/USD", "XAU/USD"
    assetClass: { 
        type: String, 
        enum: ['Forex', 'Metal', 'Crypto', 'Indices'], 
        default: 'Forex' 
    },
    currentPrice: { 
        type: String, 
        default: '0.00' 
    },
    changePercent: { 
        type: String, 
        default: '+0.00%' 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { timestamps: true });

module.exports = mongoose.model('BiasInstrument', BiasInstrumentSchema);