


// const asyncHandler = require('express-async-handler');
// const User = require('../models/User');
// const InvestorProfile = require('../models/InvestorProfile');
// // const Position = require('../models/Position'); // For future integration

// // @desc    Get main terminal dashboard data
// // @route   GET /api/v1/dashboard/terminal
// // @access  Private
// const getTerminalData = asyncHandler(async (req, res) => {
//     const user = await User.findById(req.user.id).select('firstName lastName walletBalance tier');
//     const profile = await InvestorProfile.findOne({ user: req.user.id });

//     if (!user || !profile) {
//         res.status(404);
//         throw new Error('User or Investor Profile not found.');
//     }

//     // Convert wallet balance from cents to dollars (if you store it in cents)
//     const availableBalance = (user.walletBalance || 0) / 100;

//     // TODO: In the future, this will be dynamically calculated by querying your Position/Order models 
//     // and aggregating PnL from your execution engine. For now, we seed it based on their tier.
//     const hasActivePortfolio = availableBalance > 0 || profile.planTier !== 'starter-tier';

//     const payload = {
//         success: true,
//         data: {
//             user: {
//                 firstName: user.firstName,
//                 tier: profile.planTier,
//                 riskCap: profile.riskTolerance === 'aggressive' ? '8.5% Drawdown' : '3.2% Drawdown',
//             },
//             hasActivePortfolio,
//             metrics: hasActivePortfolio ? {
//                 totalValue: availableBalance > 0 ? availableBalance : 482910, 
//                 activePositionsCount: 14,
//                 ytdReturn: 18.4,
//                 sharpeRatio: 2.41,
//             } : null,
//             strategy: hasActivePortfolio ? {
//                 poolName: 'Quantitative Pool',
//                 mandateTier: `Tier ${profile.planTier === 'institutional' ? 1 : 3} Mandate`,
//                 strategyName: 'Gamma Exposure & L3 Order Book Arbitrage',
//                 allocatedAmount: 376670,
//                 capacityPercent: 78
//             } : null,
//             // Mocking the active positions to match your UI
//             positions: hasActivePortfolio ? [
//                 { asset: 'EUR', name: 'EUR/USD Long Spread', size: 120000, pnlAmount: 2410, pnlPercent: 2.01, status: 'Active', isPositive: true },
//                 { asset: 'BTC', name: 'BTC/USD Delta Neutral Hedge', size: 185000, pnlAmount: 5840, pnlPercent: 3.15, status: 'Active', isPositive: true },
//                 { asset: 'SPX', name: 'S&P 500 Put Option Overlay', size: 71670, pnlAmount: -410, pnlPercent: -0.57, status: 'Hedging', isPositive: false },
//             ] : [],
//             // NAV Chart Data (Last 7 Days)
//             chartData: [400000, 420000, 415000, 440000, 430000, 460000, 482910] 
//         }
//     };

//     res.status(200).json(payload);
// });

// module.exports = { getTerminalData };



const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const InvestorProfile = require('../models/InvestorProfile');
const PLANS = require('../config/plans'); // Import actual plans

// @desc    Get main terminal dashboard data
// @route   GET /api/v1/dashboard/terminal
// @access  Private
const getTerminalData = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('firstName lastName walletBalance tier');
    const profile = await InvestorProfile.findOne({ user: req.user.id });

    if (!user || !profile) {
        res.status(404);
        throw new Error('User or Investor Profile not found.');
    }

    // 1. Get real plan configuration based on user's active tier
    const activePlanSlug = user.tier?.level || profile.planTier;
    const planConfig = Object.values(PLANS).find(p => p.slug === activePlanSlug) || null;

    // 2. Calculate Real Portfolio Value
    // Wallet balance (cents to dollars) + The capital allocation of their active plan
    const walletBalanceUSD = (user.walletBalance || 0) / 100;
    const planCapitalUSD = planConfig ? planConfig.price : 0;
    const totalPortfolioValue = walletBalanceUSD + planCapitalUSD;

    const hasActivePortfolio = totalPortfolioValue > 0;

    const payload = {
        success: true,
        data: {
            user: {
                firstName: user.firstName,
                tier: planConfig ? planConfig.name : 'Unassigned',
                riskCap: profile.riskTolerance === 'aggressive' ? '8.5% Drawdown Limit' : '3.2% Drawdown Limit',
            },
            hasActivePortfolio,
            metrics: hasActivePortfolio ? {
                totalValue: totalPortfolioValue,
                // Genuine data: If they haven't traded yet, positions are 0.
                activePositionsCount: 0, 
                ytdReturn: 0.0,
                sharpeRatio: 0.0,
            } : null,
            strategy: hasActivePortfolio && planConfig ? {
                poolName: 'Quantitative Pool',
                mandateTier: planConfig.name,
                strategyName: 'Gamma Exposure & L3 Order Book Arbitrage',
                allocatedAmount: planCapitalUSD,
                capacityPercent: 0 // Genuine: 0% utilized until execution engine runs
            } : null,
            
            // Genuine: Empty array because no real trades have occurred yet
            positions: [], 
            
            // Genuine: A flat line representing their starting capital until the daily cron job updates it
            chartData: [totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue] 
        }
    };

    res.status(200).json(payload);
});

module.exports = { getTerminalData };