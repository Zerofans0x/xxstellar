

const mongoose = require('mongoose');
const PLANS = require('../config/plans');

const InvestorProfileSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        unique: true 
    },
    
    // --- PORTFOLIO GOVERNANCE TIER (Unified Slugs) ---
    planTier: { 
        type: String, 
        enum: ['starter-tier', 'growth-tier', 'executive-tier', 'institutional'], 
        default: 'growth-tier' 
    },

    // --- ONBOARDING TELEMETRY ---
    experienceLevel: { 
        type: String, 
        enum: ['Retail/Novice', 'Experienced', 'Algorithmic'],
        required: true
    },
    marketsOfInterest: { 
        type: [String], 
        required: true 
    },
    primaryGoal: { 
        type: String, 
        required: true 
    },
    riskTolerance: {
        type: String,
        enum: ['Conservative', 'Moderate', 'Aggressive', 'Algorithmic'],
        default: 'Moderate'
    },

    // --- STRATEGY & MANDATE LIMITS ---
    activeMandates: [{
        mandateId: { type: String },
        strategyName: String,
        allocatedCapital: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true }
    }],
    
    maxMandates: { type: Number, default: 1 },
    maxCapitalAllocation: { type: Number, default: 3000 },

    // --- TERMINAL PREFERENCES ---
    preferences: {
        autoRebalance: { type: Boolean, default: false },
        notifyOnDrawdown: { type: Boolean, default: true },
        riskTelemetryAlerts: { type: Boolean, default: true }
    }

}, { timestamps: true });

// ---------------------------------------------------------
//  ⚡️ AUTOMATION: Sync Limits & Handle Tier Downgrades
// ---------------------------------------------------------
InvestorProfileSchema.pre('save', async function() { 
    if (this.isModified('planTier')) {
        // Map the unified slugs back to the PLANS config keys
        const slugToKeyMap = {
            'starter-tier': 'STARTER_TIER',
            'growth-tier': 'GROWTH_TIER',
            'executive-tier': 'EXECUTIVE_TIER',
            'institutional': 'INSTITUTIONAL'
        };
        
        const planKey = slugToKeyMap[this.planTier] || 'GROWTH_TIER';
        const planConfig = PLANS[planKey];

        if (planConfig && planConfig.features) {
            this.maxMandates = planConfig.features.maxMandates;
            this.maxCapitalAllocation = planConfig.features.maxCapitalAllocation;

            if (planKey === 'STARTER_TIER') {
                this.preferences.autoRebalance = false;
                if (this.activeMandates.length > this.maxMandates) {
                    this.activeMandates.forEach((mandate, index) => {
                        if (index >= this.maxMandates) {
                            mandate.isActive = false;
                        }
                    });
                }
                console.log(`📉 User on STARTER TIER: Advanced telemetry locked.`);
            }
        }
    }
});

module.exports = mongoose.model('InvestorProfile', InvestorProfileSchema);