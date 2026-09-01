const asyncHandler = require('express-async-handler');
const User = require('../models/User'); 
const InvestorProfile = require('../models/InvestorProfile'); // Updated Model
const PLANS = require('../config/plans');

// @desc    Save Onboarding Telemetry & Prepare Tier/Payment
// @route   POST /api/v1/profile/onboarding
const saveOnboarding = asyncHandler(async (req, res) => {
    // Destructured fields matched to the new InvestorProfile schema
    const { experienceLevel, marketsOfInterest, primaryGoal, planTier } = req.body; 
    
    // 1. Basic Validation
    if (!experienceLevel || !marketsOfInterest || !primaryGoal || !planTier) {
        res.status(400);
        throw new Error('Please complete all telemetry fields and select a terminal tier.');
    }

    // 2. Validate Selected Plan (Handles hyphens, underscores, and case discrepancies)
    const requestedTier = planTier.trim().toLowerCase();
    const selectedPlan = Object.entries(PLANS).find(([key, p]) => 
        key.toLowerCase() === requestedTier || 
        key.toLowerCase().replace(/_/g, '-') === requestedTier ||
        p.slug.toLowerCase() === requestedTier
    )?.[1];

    if (!selectedPlan) {
        res.status(400); 
        throw new Error('Invalid institutional tier selected.');
    }

    // 3. Save or Update the Profile Draft
    let profile = await InvestorProfile.findOne({ user: req.user.id });
    if (!profile) {
        profile = new InvestorProfile({ user: req.user.id });
    }

    profile.experienceLevel = experienceLevel;
    profile.primaryGoal = primaryGoal;
    profile.planTier = selectedPlan.slug; // Ensure the plan tier slug is saved to the profile
    profile.marketsOfInterest = Array.isArray(marketsOfInterest) ? marketsOfInterest : [marketsOfInterest];

    
    // Assign default Risk Tolerance based on experience level
    if (experienceLevel === 'Retail/Novice') profile.riskTolerance = 'Moderate';
    else if (experienceLevel === 'Experienced') profile.riskTolerance = 'Aggressive';
    else profile.riskTolerance = 'Algorithmic';

    await profile.save();

    // 4. Handle Routing (Standard vs Premium/Institutional)
    if (selectedPlan.price === 0) {
        
        // --- STANDARD PLAN (FREE / BASE TIER) ---
        // Complete onboarding immediately and activate standard terminal access
        await User.findByIdAndUpdate(
            req.user.id, 
            { 
                isOnboarded: true,
                'tier.level': selectedPlan.slug, // e.g., 'standard'
                'tier.status': 'active',
                'tier.startDate': Date.now(),
                'tier.expiryDate': null 
            }
        );

        return res.status(200).json({
            success: true,
            isOnboarded: true, 
            message: 'Telemetry synchronized. Welcome to StellarTerm.',
            action: 'REDIRECT_DASHBOARD',
            profile
        });

    } else {
        
        // --- PREMIUM / INSTITUTIONAL PLANS (PAID) ---
        // Do NOT mark as onboarded yet. Save the intent to the user model.
        await User.findByIdAndUpdate(
            req.user.id,
            {
                'tier.level': selectedPlan.slug,
                'tier.status': 'pending'
            }
        );

        // Tell the frontend to proceed to the capital allocation / payment phase
        return res.status(200).json({
            success: true,
            isOnboarded: false, 
            message: 'Risk parameters saved. Proceed to capital allocation.',
            action: 'REDIRECT_PAYMENT',
            planSlug: selectedPlan.slug 
        });
    }
});

module.exports = {
    saveOnboarding,
};