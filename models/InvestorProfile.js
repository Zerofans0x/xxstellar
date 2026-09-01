const mongoose = require('mongoose');

// Assuming you will update your plans config to match these new tiers
const PLANS = require('../config/plans');

const InvestorProfileSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true, 
        unique: true 
    },
    
    // --- PORTFOLIO GOVERNANCE TIER ---
    planTier: { 
        type: String, 
        enum: ['Standard', 'Premium', 'Institutional'], 
        default: 'Standard' 
    },

    // --- ONBOARDING TELEMETRY ---
    experienceLevel: { 
        type: String, 
        enum: ['Retail/Novice', 'Experienced', 'Institutional/Quant'],
        required: true
    },
    marketsOfInterest: { 
        type: [String], 
        // e.g., ['Digital Assets', 'Forex Liquidity', 'Equities Overlay', 'Fixed Income']
        required: true 
    },
    primaryGoal: { 
        type: String, 
        // e.g., 'Capital Preservation', 'Delta-Neutral Yield', 'Aggressive Growth'
        required: true 
    },
    riskTolerance: {
        type: String,
        enum: ['Conservative', 'Moderate', 'Aggressive', 'Algorithmic'],
        default: 'Moderate'
    },

    // --- STRATEGY & MANDATE LIMITS ---
    activeMandates: [{
        mandateId: { type: String }, // Cryptographic hash or reference
        strategyName: String,
        allocatedCapital: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true }
    }],
    
    // Numeric limits based on tier (populated by pre-save hook)
    maxMandates: { type: Number, default: 1 },
    maxCapitalAllocation: { type: Number, default: 10000 },

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
    
    // Only run logic if the planTier has changed
    if (this.isModified('planTier')) {
        
        const planKey = (this.planTier || 'Standard').toUpperCase();
        
        // Fallback limits if PLANS config isn't fully set up yet
        const defaultLimits = {
            STANDARD: { maxMandates: 1, maxCapitalAllocation: 10000 },
            PREMIUM: { maxMandates: 5, maxCapitalAllocation: 100000 },
            INSTITUTIONAL: { maxMandates: 999, maxCapitalAllocation: 999999999 }
        };

        const planConfig = PLANS[planKey] || { features: defaultLimits[planKey] };

        if (planConfig && planConfig.features) {
            // 1. Update the numeric limits for risk engine
            this.maxMandates = planConfig.features.maxMandates;
            this.maxCapitalAllocation = planConfig.features.maxCapitalAllocation;

            // 2. Handle Downgrade to Standard
            if (planKey === 'STANDARD') {
                this.preferences.autoRebalance = false;
                
                // Optional: Deactivate mandates that exceed the new Standard limit
                if (this.activeMandates.length > this.maxMandates) {
                    // Keep the first one active, deactivate the rest
                    this.activeMandates.forEach((mandate, index) => {
                        if (index >= this.maxMandates) {
                            mandate.isActive = false;
                        }
                    });
                }
                console.log(`📉 User downgraded to STANDARD: Advanced telemetry locked.`);
            }
        }
    }
});

module.exports = mongoose.model('InvestorProfile', InvestorProfileSchema);