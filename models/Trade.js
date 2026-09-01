const mongoose = require('mongoose');

const TradeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TradingAccount'
    },
    ticketId: {
        type: String // MT4/MT5 order ticket number
    },
    pair: {
        type: String,
        required: true,
        uppercase: true
    },
    direction: {
        type: String,
        enum: ['BUY', 'SELL'],
        required: true
    },
    lotSize: {
        type: Number,
        required: true
    },
    entryPrice: {
        type: Number,
        required: true
    },
    exitPrice: {
        type: Number,
        required: true
    },
    stopLoss: {
        type: Number
    },
    takeProfit: {
        type: Number
    },
    pnl: {
        type: Number,
        required: true
    },
    rMultiple: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['WIN', 'LOSS', 'BREAKEVEN'],
        required: true
    },
    session: {
        type: String,
        enum: ['LONDON', 'NEW_YORK', 'ASIAN', 'OVERLAP'],
        default: 'LONDON'
    },
    closedEarly: {
        type: Boolean,
        default: false // Tracks premature TP exits for behavioral insights
    },
    missedProfit: {
        type: Number,
        default: 0
    },
    executedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for date range queries (Calendar View)
TradeSchema.index({ user: 1, executedAt: -1 });

// Add this index at the bottom of your existing models/Trade.js file:
// This compound index ensures a single MT4/MT5 ticket number cannot be duplicated for the same user.
TradeSchema.index({ user: 1, ticketId: 1 }, { unique: true, sparse: true });


module.exports = mongoose.model('Trade', TradeSchema);


