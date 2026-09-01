// const mongoose = require('mongoose');
// const PLANS = require('../config/plans');

// const PsycheProfileSchema = new mongoose.Schema({
//     user: { 
//         type: mongoose.Schema.Types.ObjectId, 
//         ref: 'User', 
//         required: true, 
//         unique: true 
//     },
    
//     planTier: { 
//         type: String, 
//         enum: ['Basic', 'Pro', 'Ultra'], 
//         default: 'Basic' 
//     },

//     // --- ONBOARDING DATA (From Figma) ---
//     experienceLevel: { 
//         type: String, 
//         enum: ['Beginner', 'Intermediate', 'Advanced'],
//         required: true
//     },
//     marketsOfInterest: { 
//         type: [String], // e.g., ['Forex', 'Crypto']
//         required: true 
//     },
//     mainGoal: { 
//         type: String, 
//         required: true 
//     },

//     // --- PROGRESS & PATH ---
//     // You can use this to track which path was assigned to them (e.g. "Beginner path")
//     assignedPath: {
//         type: String,
//         default: 'Forex Fundamentals'
//     }

// }, { timestamps: true });

// // Automation hook to sync limits if they downgrade/upgrade
// PsycheProfileSchema.pre('save', async function() { 
//     if (this.isModified('planTier')) {
//         const planKey = (this.planTier || 'Basic').toUpperCase();
//         const planConfig = PLANS[planKey];

//         if (planConfig) {
//             // Add any logic here if you need to lock features 
//             // when a user downgrades from Ultra/Pro to Basic.
//         }
//     }
// });

// module.exports = mongoose.model('PsycheProfile', PsycheProfileSchema);


const mongoose = require('mongoose');
const PLANS = require('../config/plans');

const PsycheProfileSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        unique: true 
    },
    
    // Unified to match system tier slugs
    planTier: { 
        type: String, 
        enum: ['starter-tier', 'growth-tier', 'executive-tier', 'institutional'], 
        default: 'starter-tier' 
    },

    // --- ONBOARDING DATA (From Figma) ---
    experienceLevel: { 
        type: String, 
        enum: ['Beginner', 'Intermediate', 'Advanced'],
        required: true
    },
    marketsOfInterest: { 
        type: [String], // e.g., ['Forex', 'Crypto']
        required: true 
    },
    mainGoal: { 
        type: String, 
        required: true 
    },

    assignedPath: {
        type: String,
        default: 'Forex Fundamentals'
    }

}, { timestamps: true });

PsycheProfileSchema.pre('save', async function() { 
    if (this.isModified('planTier')) {
        const slugToKeyMap = {
            'starter-tier': 'STARTER_TIER',
            'growth-tier': 'GROWTH_TIER',
            'executive-tier': 'EXECUTIVE_TIER',
            'institutional': 'INSTITUTIONAL'
        };
        const planKey = slugToKeyMap[this.planTier] || 'STARTER_TIER';
        const planConfig = PLANS[planKey];

        if (planConfig) {
            // Future logic for downgrades
        }
    }
});

module.exports = mongoose.model('PsycheProfile', PsycheProfileSchema);