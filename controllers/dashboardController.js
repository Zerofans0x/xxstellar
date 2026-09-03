

// const asyncHandler = require('express-async-handler');
// const User = require('../models/User');
// const InvestorProfile = require('../models/InvestorProfile');
// const PLANS = require('../config/plans'); // Import actual plans

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

//     // 1. Get real plan configuration based on user's active tier
//     const activePlanSlug = user.tier?.level || profile.planTier;
//     const planConfig = Object.values(PLANS).find(p => p.slug === activePlanSlug) || null;

//     // 2. Calculate Real Portfolio Value
//     // Wallet balance (cents to dollars) + The capital allocation of their active plan
//     const walletBalanceUSD = (user.walletBalance || 0) / 100;
//     const planCapitalUSD = planConfig ? planConfig.price : 0;
//     const totalPortfolioValue = walletBalanceUSD + planCapitalUSD;

//     const hasActivePortfolio = totalPortfolioValue > 0;

//     const payload = {
//         success: true,
//         data: {
//             user: {
//                 firstName: user.firstName,
//                 tier: planConfig ? planConfig.name : 'Unassigned',
//                 riskCap: profile.riskTolerance === 'aggressive' ? '8.5% Drawdown Limit' : '3.2% Drawdown Limit',
//             },
//             hasActivePortfolio,
//             metrics: hasActivePortfolio ? {
//                 totalValue: totalPortfolioValue,
//                 // Genuine data: If they haven't traded yet, positions are 0.
//                 activePositionsCount: 0, 
//                 ytdReturn: 0.0,
//                 sharpeRatio: 0.0,
//             } : null,
//             strategy: hasActivePortfolio && planConfig ? {
//                 poolName: 'Quantitative Pool',
//                 mandateTier: planConfig.name,
//                 strategyName: 'Gamma Exposure & L3 Order Book Arbitrage',
//                 allocatedAmount: planCapitalUSD,
//                 capacityPercent: 0 // Genuine: 0% utilized until execution engine runs
//             } : null,
            
//             // Genuine: Empty array because no real trades have occurred yet
//             positions: [], 
            
//             // Genuine: A flat line representing their starting capital until the daily cron job updates it
//             chartData: [totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue] 
//         }
//     };

//     res.status(200).json(payload);
// });

// module.exports = { getTerminalData };


const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const InvestorProfile = require('../models/InvestorProfile');
const PLANS = require('../config/plans');
const { Transaction } = require('../models/Transaction');

// @desc    Get main terminal dashboard data (Genuine & Real-time)
// @route   GET /api/v1/psyche/terminal
// @access  Private
const getTerminalData = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('firstName lastName walletBalance tier');
    const profile = await InvestorProfile.findOne({ user: req.user.id });

    if (!user || !profile) {
        res.status(404);
        throw new Error('User or Investor Profile not found.');
    }

    // 1. Resolve actual active subscription plan from config
    const activePlanSlug = user.tier?.level || profile.planTier;
    const planConfig = Object.values(PLANS).find(p => p.slug === activePlanSlug) || null;

    // 2. Calculate true portfolio balance from wallet + plan capital
    const walletBalanceUSD = (user.walletBalance || 0) / 100;
    const planCapitalUSD = planConfig ? planConfig.price : 0;
    const totalPortfolioValue = walletBalanceUSD + planCapitalUSD;

    const hasActivePortfolio = totalPortfolioValue > 0 || user.tier?.status === 'active';

    // 3. Fetch real successful transactions for this user
    const recentTransactions = await Transaction.find({ 
        user: user._id, 
        status: 'success' 
    }).sort({ createdAt: -1 }).limit(5);

    const payload = {
        success: true,
        data: {
            user: {
                firstName: user.firstName,
                tier: planConfig ? planConfig.name : 'Unassigned Tier',
                riskCap: profile.riskTolerance === 'aggressive' ? '8.5% Drawdown Limit' : '3.2% Drawdown Limit',
            },
            hasActivePortfolio,
            metrics: hasActivePortfolio ? {
                totalValue: totalPortfolioValue,
                activePositionsCount: 0, // Genuine: Real positions will populate when execution engine syncs
                ytdReturn: 0.0,          // Genuine: Starts at 0% until trading activity logs performance
                sharpeRatio: 0.0,        // Genuine: Uncalibrated until historical trade data accumulates
            } : null,
            strategy: hasActivePortfolio && planConfig ? {
                poolName: 'Quantitative Pool',
                mandateTier: planConfig.name,
                strategyName: 'Gamma Exposure & L3 Order Book Arbitrage',
                allocatedAmount: planCapitalUSD,
                capacityPercent: 0 
            } : null,
            
            // Genuine: Empty until active trading positions are opened via execution engine
            positions: [], 
            
            // Genuine: Real historical deposit/funding logs
            recentTransactions: recentTransactions.map(tx => ({
                id: tx._id,
                reference: tx.reference,
                amount: tx.amount,
                type: tx.type,
                gateway: tx.gateway,
                date: tx.createdAt
            })),
            
            // Genuine: Flat baseline showing initial capital state
            chartData: [totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue, totalPortfolioValue] 
        }
    };

    res.status(200).json(payload);
});

module.exports = { getTerminalData };