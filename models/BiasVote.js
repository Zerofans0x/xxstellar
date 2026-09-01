const mongoose = require('mongoose');

const BiasVoteSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    instrument: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'BiasInstrument', 
        required: true 
    },
    vote: { 
        type: String, 
        enum: ['BULL', 'NEUTRAL', 'BEAR'], 
        required: true 
    },
    weekIdentifier: { 
        type: String, 
        required: true 
    }, // e.g., "2026-W29"
    reasonChip: { 
        type: String, 
        trim: true 
    } // Optional custom tag/reason submitted by student
}, { timestamps: true });

// Prevent duplicate votes per user per instrument per week
BiasVoteSchema.index({ user: 1, instrument: 1, weekIdentifier: 1 }, { unique: true });

module.exports = mongoose.model('BiasVote', BiasVoteSchema);