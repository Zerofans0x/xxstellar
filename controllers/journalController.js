// const asyncHandler = require('express-async-handler');
// const Trade = require('../models/Trade');
// const TradingAccount = require('../models/TradingAccount');

// // @desc    Create Trading Account & Generate Sync Token
// // @route   POST /api/v1/psyche/journal/account
// // @access  Private
// const createTradingAccount = asyncHandler(async (req, res) => {
//     const { accountNumber, platform } = req.body;

//     if (!accountNumber) {
//         res.status(400);
//         throw new Error("Account number is required.");
//     }

//     const account = await TradingAccount.create({
//         user: req.user._id,
//         accountNumber,
//         platform: platform || 'MetaTrader 5'
//     });

//     res.status(201).json({
//         success: true,
//         message: "Account created. Paste this Sync Token into your MetaTrader EA.",
//         data: {
//             accountId: account._id,
//             syncToken: account.syncToken
//         }
//     });
// });

// // @desc    MetaTrader EA Webhook (Receives trades directly from MT4/MT5)
// // @route   POST /api/v1/psyche/journal/mt-sync
// // @access  Public (Secured by syncToken header)
// const webhookMtSync = asyncHandler(async (req, res) => {
//     // The EA will send the token in the headers
//     const syncToken = req.headers['x-sync-token'];
//     const { trades } = req.body; // Expecting an array of trade objects from the EA

//     if (!syncToken) {
//         res.status(401);
//         throw new Error("Unauthorized: Missing Sync Token");
//     }

//     const account = await TradingAccount.findOne({ syncToken });
//     if (!account) {
//         res.status(401);
//         throw new Error("Unauthorized: Invalid Sync Token");
//     }

//     if (!trades || !Array.isArray(trades)) {
//         res.status(400);
//         throw new Error("Invalid payload: 'trades' array required");
//     }

//     let syncedCount = 0;

//     // Use bulkWrite for high-performance upserts (inserts new, updates existing)
//     const bulkOps = trades.map(trade => ({
//         updateOne: {
//             filter: { user: account.user, ticketId: trade.ticketId },
//             update: {
//                 $set: {
//                     user: account.user,
//                     account: account._id,
//                     ticketId: trade.ticketId,
//                     pair: trade.pair,
//                     direction: trade.direction,
//                     lotSize: trade.lotSize,
//                     entryPrice: trade.entryPrice,
//                     exitPrice: trade.exitPrice,
//                     stopLoss: trade.stopLoss,
//                     takeProfit: trade.takeProfit,
//                     pnl: trade.pnl,
//                     status: trade.pnl > 0 ? 'WIN' : trade.pnl < 0 ? 'LOSS' : 'BREAKEVEN',
//                     executedAt: new Date(trade.executedAt)
//                 }
//             },
//             upsert: true // Creates the document if it doesn't exist
//         }
//     }));

//     if (bulkOps.length > 0) {
//         await Trade.bulkWrite(bulkOps);
//         syncedCount = bulkOps.length;
//     }

//     account.lastSyncedAt = Date.now();
//     await account.save();

//     res.status(200).json({
//         success: true,
//         message: `Successfully synced ${syncedCount} trades.`
//     });
// });



// // ==========================================
// // 📅 DASHBOARD & CALENDAR METRICS
// // ==========================================

// // @desc    Get Main Journal Dashboard (Stats, Monthly Grid, 7-Day Chart)
// // @route   GET /api/v1/psyche/journal/dashboard
// // @access  Private
// const getJournalDashboard = asyncHandler(async (req, res) => {
//     const { month, year } = req.query;

//     const targetYear = parseInt(year) || new Date().getFullYear();
//     const targetMonth = parseInt(month) ? parseInt(month) - 1 : new Date().getMonth();

//     const startOfMonth = new Date(targetYear, targetMonth, 1);
//     const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

//     const trades = await Trade.find({
//         user: req.user._id,
//         executedAt: { $gte: startOfMonth, $lte: endOfMonth }
//     }).sort({ executedAt: 1 });

//     // 1. Calculate Core KPI Cards
//     const totalTrades = trades.length;
//     let netPnL = 0;
//     let totalWins = 0;
//     let grossProfit = 0;
//     let grossLoss = 0;
//     let totalR = 0;

//     // Group trades by day for the calendar grid
//     const dailyMap = {};

//     trades.forEach(trade => {
//         netPnL += trade.pnl;
//         totalR += trade.rMultiple;

//         if (trade.pnl > 0) {
//             totalWins += 1;
//             grossProfit += trade.pnl;
//         } else if (trade.pnl < 0) {
//             grossLoss += Math.abs(trade.pnl);
//         }

//         // Format date string YYYY-MM-DD
//         const dayKey = trade.executedAt.toISOString().split('T')[0];
//         if (!dailyMap[dayKey]) {
//             dailyMap[dayKey] = { netPnL: 0, tradeCount: 0, wins: 0 };
//         }
//         dailyMap[dayKey].netPnL += trade.pnl;
//         dailyMap[dayKey].tradeCount += 1;
//         if (trade.pnl > 0) dailyMap[dayKey].wins += 1;
//     });

//     const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;
//     const avgRR = totalTrades > 0 ? (totalR / totalTrades).toFixed(1) : "0.0";
//     const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? grossProfit.toFixed(2) : "0.00";

//     // 2. Format Daily Calendar Items
//     const calendarGrid = Object.keys(dailyMap).map(dateStr => {
//         const dayData = dailyMap[dateStr];
//         let status = 'MIXED';
//         if (dayData.netPnL > 0) status = 'POSITIVE';
//         if (dayData.netPnL < 0) status = 'NEGATIVE';

//         return {
//             date: dateStr,
//             netPnL: dayData.netPnL,
//             formattedPnL: `${dayData.netPnL >= 0 ? '+' : '-'}$${Math.abs(dayData.netPnL)}`,
//             tradeCount: dayData.tradeCount,
//             status
//         };
//     });

//     // 3. Last 7 Days Equity Chart Data
//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//     const recentTrades = await Trade.find({
//         user: req.user._id,
//         executedAt: { $gte: sevenDaysAgo }
//     }).sort({ executedAt: 1 });

//     let runningEquity = 10000; // Baseline
//     const activityChart = recentTrades.map(t => {
//         runningEquity += t.pnl;
//         return {
//             date: t.executedAt.toLocaleDateString('en-US', { weekday: 'short' }),
//             equity: runningEquity
//         };
//     });

//     res.status(200).json({
//         success: true,
//         data: {
//             kpis: {
//                 netPnL: `${netPnL >= 0 ? '+' : '-'}$${Math.abs(netPnL).toLocaleString()}`,
//                 netPnLRaw: netPnL,
//                 winRate: `${winRate}%`,
//                 avgRR: `1 : ${avgRR}`,
//                 profitFactor: profitFactor
//             },
//             calendarGrid,
//             activityChart
//         }
//     });
// });

// // @desc    Get Detailed Trades for a Selected Calendar Day
// // @route   GET /api/v1/psyche/journal/day/:dateStr
// // @access  Private
// const getTradesForDay = asyncHandler(async (req, res) => {
//     const { dateStr } = req.params; // Expects 'YYYY-MM-DD'
//     const start = new Date(dateStr);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(dateStr);
//     end.setHours(23, 59, 59, 999);

//     const trades = await Trade.find({
//         user: req.user._id,
//         executedAt: { $gte: start, $lte: end }
//     }).sort({ executedAt: -1 });

//     let dayPnL = 0;
//     let totalR = 0;
//     let wins = 0;

//     trades.forEach(t => {
//         dayPnL += t.pnl;
//         totalR += t.rMultiple;
//         if (t.pnl > 0) wins++;
//     });

//     const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;

//     res.status(200).json({
//         success: true,
//         data: {
//             date: dateStr,
//             summary: {
//                 netPnL: `${dayPnL >= 0 ? '+' : '-'}$${Math.abs(dayPnL)}`,
//                 totalR: `${totalR >= 0 ? '+' : '-'}${totalR.toFixed(1)}R`,
//                 tradeCount: trades.length,
//                 winRate: `${winRate}%`
//             },
//             trades
//         }
//     });
// });

// // ==========================================
// // 💡 BEHAVIORAL INSIGHTS ENGINE
// // ==========================================

// // @desc    Get AI Behavioral Performance Insights
// // @route   GET /api/v1/psyche/journal/insights
// // @access  Private
// const getJournalInsights = asyncHandler(async (req, res) => {
//     const trades = await Trade.find({ user: req.user._id });

//     if (trades.length === 0) {
//         return res.status(200).json({
//             success: true,
//             data: { insights: [] }
//         });
//     }

//     const insights = [];

//     // Insight 1: London Session Win Rate Calculation
//     const londonTrades = trades.filter(t => t.session === 'LONDON');
//     if (londonTrades.length >= 3) {
//         const londonWins = londonTrades.filter(t => t.pnl > 0).length;
//         const londonWinRate = Math.round((londonWins / londonTrades.length) * 100);

//         insights.push({
//             id: 'london-session-leak',
//             title: `Your London session win rate is ${londonWinRate}%`,
//             description: `You perform significantly better during the London open (8–11am GMT). Consider focusing your trading sessions here and avoiding NY-only setups where your win rate drops.`
//         });
//     }

//     // Insight 2: Early Exits (TP Leak Analysis)
//     const earlyExitTrades = trades.filter(t => t.closedEarly);
//     if (earlyExitTrades.length > 0) {
//         const totalMissedProfit = earlyExitTrades.reduce((sum, t) => sum + t.missedProfit, 0);
//         const avgMissed = Math.round(totalMissedProfit / earlyExitTrades.length);

//         insights.push({
//             id: 'early-exit-leak',
//             title: "You exit winning trades too early",
//             description: `On ${earlyExitTrades.length} winning trades this month you closed before your take-profit — leaving an average of $${avgMissed} per trade on the table. Total missed profit: -$${totalMissedProfit}.`
//         });
//     }

//     res.status(200).json({
//         success: true,
//         count: insights.length,
//         data: { insights }
//     });
// });

// // ==========================================
// // 🎨 SOCIAL PNL SHARE CARD GENERATOR
// // ==========================================

// // @desc    Get Share Card Payload (Matches pnlP-psy 1.jpg Design)
// // @route   GET /api/v1/psyche/journal/share-card
// // @access  Private
// const getPnLShareCardData = asyncHandler(async (req, res) => {
//     const trades = await Trade.find({ user: req.user._id });

//     let netPnL = 0;
//     let totalWins = 0;
//     let grossProfit = 0;
//     let grossLoss = 0;
//     let totalR = 0;

//     trades.forEach(trade => {
//         netPnL += trade.pnl;
//         totalR += trade.rMultiple;
//         if (trade.pnl > 0) {
//             totalWins += 1;
//             grossProfit += trade.pnl;
//         } else if (trade.pnl < 0) {
//             grossLoss += Math.abs(trade.pnl);
//         }
//     });

//     const totalTrades = trades.length;
//     const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;
//     const avgRR = totalTrades > 0 ? (totalR / totalTrades).toFixed(1) : "0.0";
//     const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : "0.00";

//     const formattedDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
//     const formattedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

//     res.status(200).json({
//         success: true,
//         data: {
//             userHandle: `@${req.user.username || 'trader'}`,
//             timestamp: `${formattedDate} ${formattedTime}`,
//             metrics: {
//                 netPnL: `${netPnL >= 0 ? '+' : '-'}$${Math.abs(netPnL)}`,
//                 winRate: `${winRate}%`,
//                 avgRR: `1 : ${avgRR}`,
//                 profitFactor: profitFactor
//             },
//             verificationUrl: `${process.env.PSYCHE_FRONTEND_URL}/journal/verify/${req.user._id}`
//         }
//     });
// });

// // @desc    Manually Add a Trade Log
// // @route   POST /api/v1/psyche/journal/trades
// // @access  Private
// const addManualTrade = asyncHandler(async (req, res) => {
//     const { pair, direction, lotSize, entryPrice, exitPrice, stopLoss, takeProfit, pnl, session, closedEarly, missedProfit } = req.body;

//     if (!pair || !direction || !lotSize || !entryPrice || !exitPrice || pnl === undefined) {
//         res.status(400);
//         throw new Error("Please provide pair, direction, lot size, entry price, exit price, and PnL.");
//     }

//     const status = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';

//     // R Multiple Calculation
//     let rMultiple = 0;
//     if (stopLoss && stopLoss !== entryPrice) {
//         const riskDistance = Math.abs(entryPrice - stopLoss);
//         const rewardDistance = Math.abs(exitPrice - entryPrice);
//         rMultiple = parseFloat((rewardDistance / riskDistance).toFixed(2));
//         if (status === 'LOSS') rMultiple = -1.0;
//     }

//     const trade = await Trade.create({
//         user: req.user._id,
//         pair,
//         direction,
//         lotSize,
//         entryPrice,
//         exitPrice,
//         stopLoss,
//         takeProfit,
//         pnl,
//         rMultiple,
//         status,
//         session: session || 'LONDON',
//         closedEarly: closedEarly || false,
//         missedProfit: missedProfit || 0
//     });

//     res.status(201).json({
//         success: true,
//         data: trade
//     });
// });

// module.exports = {
//     createTradingAccount,
//     webhookMtSync,
//     getJournalDashboard,
//     getTradesForDay,
//     getJournalInsights,
//     getPnLShareCardData,
//     addManualTrade
// };



const asyncHandler = require('express-async-handler');
const Trade = require('../models/Trade');
const TradingAccount = require('../models/TradingAccount');
const MetaApi = require('metaapi.cloud-sdk').default;
const { MetaStats } = require('metaapi.cloud-metastats-sdk');

// Initialize MetaApi with your API token from your .env file
const META_API_TOKEN = process.env.META_API_TOKEN; 
const api = new MetaApi(META_API_TOKEN);
const metaStats = new MetaStats(META_API_TOKEN);

// ==========================================
// 🔌 META-API CONNECTION & SYNC
// ==========================================

// @desc    Connect MT4/MT5 Broker Account via MetaApi Cloud
// @route   POST /api/v1/psyche/journal/account/connect
// @access  Private
const connectBrokerAccount = asyncHandler(async (req, res) => {
    const { accountNumber, brokerServer, investorPassword, platform } = req.body;

    if (!accountNumber || !brokerServer || !investorPassword) {
        res.status(400);
        throw new Error("Please provide account login ID, server, and investor password.");
    }

    let account = await TradingAccount.findOne({ user: req.user._id, accountNumber });

    if (!account) {
        try {
            const platformType = platform.toLowerCase().includes('5') ? 'mt5' : 'mt4';

            const metaApiAccount = await api.metatraderAccountApi.createAccount({
                name: `Psychedelia-User-${req.user._id}`,
                type: 'cloud-g1',
                login: accountNumber,
                password: investorPassword,
                server: brokerServer,
                platform: platformType,
                application: 'MetaApi',
                magic: 0,
            });

            await metaApiAccount.deploy();
            await metaApiAccount.waitConnected();

            account = await TradingAccount.create({
                user: req.user._id,
                platform: platform || 'MetaTrader 4/5',
                accountNumber,
                brokerServer,
                investorPassword, 
                metaApiAccountId: metaApiAccount.id,
                syncStatus: 'CONNECTED'
            });
        } catch (error) {
            res.status(500);
            throw new Error(`MetaApi Connection Failed: ${error.message}`);
        }
    }

    res.status(200).json({
        success: true,
        message: "Broker account connected securely via MetaApi.",
        data: {
            accountId: account._id,
            metaApiAccountId: account.metaApiAccountId,
            status: account.syncStatus
        }
    });
});



// @desc    Trigger Manual Sync Refresh via MetaStats
// @route   POST /api/v1/psyche/journal/account/sync
// @access  Private
const syncAccountTrades = asyncHandler(async (req, res) => {
    const account = await TradingAccount.findOne({ user: req.user._id }).sort({ createdAt: -1 });

    if (!account || !account.metaApiAccountId) {
        res.status(404);
        throw new Error("No valid MetaApi trading account connected.");
    }

    try {
        const currentYear = new Date().getFullYear();
        const startTime = new Date(`${currentYear}-01-01T00:00:00.000Z`);
        const endTime = new Date(); 

        // FIX 1: Changed 'metaApi' to 'api' to match your initialization at the top
        const metaApiAccount = await api.metatraderAccountApi.getAccount(account.metaApiAccountId);
        const connection = metaApiAccount.getRPCConnection();
        
        await connection.connect();
        await connection.waitSynchronized(); 

        const historicalTrades = await connection.getDealsByTimeRange(startTime, endTime);
        
        console.log("Direct MT5 Terminal Deals:", JSON.stringify(historicalTrades, null, 2));

        let newTradesCount = 0;

        for (const trade of historicalTrades.deals) {
            const ticketId = (trade.id || trade.ticket || '').toString();
            if (!ticketId) continue;

            const existingTrade = await Trade.findOne({ ticketId });
            
            const isClosedDeal = trade.entryType === 'DEAL_ENTRY_OUT' || trade.entryType === 'DEAL_ENTRY_INOUT';
            const isNotBalance = trade.type !== 'DEAL_TYPE_BALANCE';

            if (!existingTrade && isClosedDeal && isNotBalance) {
                const isBuy = trade.type === 'DEAL_TYPE_BUY';

                await Trade.create({
                    user: req.user._id,
                    account: account._id,
                    ticketId: ticketId,
                    pair: trade.symbol || 'UNKNOWN',
                    direction: isBuy ? 'BUY' : 'SELL',
                    lotSize: trade.volume,
                    entryPrice: trade.price || 0,
                    exitPrice: trade.price || 0, 
                    pnl: trade.profit,
                    status: trade.profit > 0 ? 'WIN' : trade.profit < 0 ? 'LOSS' : 'BREAKEVEN',
                    executedAt: new Date(trade.time || Date.now())
                });
                newTradesCount++;
            }
        }

        account.lastSyncedAt = Date.now();
        await account.save();

        res.status(200).json({
            success: true,
            message: `Trade data synchronized. ${newTradesCount} new trades imported.`,
            lastSyncedAt: account.lastSyncedAt
        });

    } catch (error) {
        console.error("Direct RPC Sync Error:", error); 
        res.status(500);
        throw new Error(`Failed to pull terminal history: ${error.message}`);
    }
}); 


// ==========================================
// 📅 DASHBOARD & CALENDAR METRICS
// ==========================================

// // @desc    Get Main Journal Dashboard (Stats, Monthly Grid, 7-Day Chart)
// // @route   GET /api/v1/psyche/journal/dashboard
// // @access  Private
// const getJournalDashboard = asyncHandler(async (req, res) => {
//     const { month, year } = req.query;

//     const targetYear = parseInt(year) || new Date().getFullYear();
//     const targetMonth = parseInt(month) ? parseInt(month) - 1 : new Date().getMonth();

//     const startOfMonth = new Date(targetYear, targetMonth, 1);
//     const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

//     const trades = await Trade.find({
//         user: req.user._id,
//         executedAt: { $gte: startOfMonth, $lte: endOfMonth }
//     }).sort({ executedAt: 1 });

//     const totalTrades = trades.length;
//     let netPnL = 0;
//     let totalWins = 0;
//     let grossProfit = 0;
//     let grossLoss = 0;
//     let totalR = 0;

//     const dailyMap = {};

//     trades.forEach(trade => {
//         netPnL += trade.pnl;
//         totalR += trade.rMultiple || 0; // Guard against NaN

//         if (trade.pnl > 0) {
//             totalWins += 1;
//             grossProfit += trade.pnl;
//         } else if (trade.pnl < 0) {
//             grossLoss += Math.abs(trade.pnl);
//         }

//         const dayKey = trade.executedAt.toISOString().split('T')[0];
//         if (!dailyMap[dayKey]) {
//             dailyMap[dayKey] = { netPnL: 0, tradeCount: 0, wins: 0 };
//         }
//         dailyMap[dayKey].netPnL += trade.pnl;
//         dailyMap[dayKey].tradeCount += 1;
//         if (trade.pnl > 0) dailyMap[dayKey].wins += 1;
//     });

//     const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;
//     const avgRR = totalTrades > 0 ? (totalR / totalTrades).toFixed(1) : "0.0";
//     const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? grossProfit.toFixed(2) : "0.00";

//     const calendarGrid = Object.keys(dailyMap).map(dateStr => {
//         const dayData = dailyMap[dateStr];
//         let status = 'MIXED';
//         if (dayData.netPnL > 0) status = 'POSITIVE';
//         if (dayData.netPnL < 0) status = 'NEGATIVE';

//         return {
//             date: dateStr,
//             netPnL: dayData.netPnL,
//             formattedPnL: `${dayData.netPnL >= 0 ? '+' : '-'}$${Math.abs(dayData.netPnL)}`,
//             tradeCount: dayData.tradeCount,
//             status
//         };
//     });

//     const sevenDaysAgo = new Date();
//     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

//     const recentTrades = await Trade.find({
//         user: req.user._id,
//         executedAt: { $gte: sevenDaysAgo }
//     }).sort({ executedAt: 1 });

//     let runningEquity = 10000; 
//     const activityChart = recentTrades.map(t => {
//         runningEquity += t.pnl;
//         return {
//             date: t.executedAt.toLocaleDateString('en-US', { weekday: 'short' }),
//             equity: runningEquity
//         };
//     });

//     res.status(200).json({
//         success: true,
//         data: {
//             kpis: {
//                 netPnL: `${netPnL >= 0 ? '+' : '-'}$${Math.abs(netPnL).toLocaleString()}`,
//                 netPnLRaw: netPnL,
//                 winRate: `${winRate}%`,
//                 avgRR: `1 : ${avgRR}`,
//                 profitFactor: profitFactor
//             },
//             calendarGrid,
//             activityChart
//         }
//     });
// });


// @desc    Get Main Journal Dashboard (Stats, Monthly Grid, 30-Day Chart)
// @route   GET /api/v1/psyche/journal/dashboard
// @access  Private
const getJournalDashboard = asyncHandler(async (req, res) => {
    const { month, year } = req.query;

    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) ? parseInt(month) - 1 : new Date().getMonth();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const trades = await Trade.find({
        user: req.user._id,
        executedAt: { $gte: startOfMonth, $lte: endOfMonth }
    }).sort({ executedAt: 1 });

    const totalTrades = trades.length;
    let netPnL = 0;
    let totalWins = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalR = 0;

    const dailyMap = {};

    trades.forEach(trade => {
        netPnL += trade.pnl;
        totalR += trade.rMultiple || 0; // Guard against NaN

        if (trade.pnl > 0) {
            totalWins += 1;
            grossProfit += trade.pnl;
        } else if (trade.pnl < 0) {
            grossLoss += Math.abs(trade.pnl);
        }

        const dayKey = trade.executedAt.toISOString().split('T')[0];
        if (!dailyMap[dayKey]) {
            dailyMap[dayKey] = { netPnL: 0, tradeCount: 0, wins: 0 };
        }
        dailyMap[dayKey].netPnL += trade.pnl;
        dailyMap[dayKey].tradeCount += 1;
        if (trade.pnl > 0) dailyMap[dayKey].wins += 1;
    });

    // Clean rounding for main metrics
    netPnL = parseFloat(netPnL.toFixed(2));
    const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;
    const avgRR = totalTrades > 0 ? (totalR / totalTrades).toFixed(1) : "0.0";
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? grossProfit.toFixed(2) : "0.00";

    const calendarGrid = Object.keys(dailyMap).map(dateStr => {
        const dayData = dailyMap[dateStr];
        const roundedDayPnL = parseFloat(dayData.netPnL.toFixed(2));

        let status = 'MIXED';
        if (roundedDayPnL > 0) status = 'POSITIVE';
        if (roundedDayPnL < 0) status = 'NEGATIVE';

        return {
            date: dateStr,
            netPnL: roundedDayPnL,
            formattedPnL: `${roundedDayPnL >= 0 ? '+' : '-'}$${Math.abs(roundedDayPnL).toFixed(2)}`,
            tradeCount: dayData.tradeCount,
            status
        };
    });

    // ============================================================
    // 📊 REPLACED SECTION: 30-DAY ACTIVITY CHART WITH PAIR DETAILS
    // ============================================================
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTrades = await Trade.find({
        user: req.user._id,
        executedAt: { $gte: thirtyDaysAgo }
    }).sort({ executedAt: 1 });

    let runningEquity = 10000; // Starting baseline demo balance
    const activityChart = recentTrades.map(t => {
        runningEquity += t.pnl;
        return {
            date: t.executedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            pair: t.pair || 'UNKNOWN',
            direction: t.direction || 'BUY',
            pnl: parseFloat(t.pnl.toFixed(2)),
            equity: parseFloat(runningEquity.toFixed(2))
        };
    });

    res.status(200).json({
        success: true,
        data: {
            kpis: {
                netPnL: `${netPnL >= 0 ? '+' : '-'}$${Math.abs(netPnL).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                netPnLRaw: netPnL,
                winRate: `${winRate}%`,
                avgRR: `1 : ${avgRR}`,
                profitFactor: profitFactor
            },
            calendarGrid,
            activityChart
        }
    });
});



// @desc    Get Detailed Trades for a Selected Calendar Day
// @route   GET /api/v1/psyche/journal/day/:dateStr
// @access  Private
const getTradesForDay = asyncHandler(async (req, res) => {
    const { dateStr } = req.params; 
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);

    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);

    const trades = await Trade.find({
        user: req.user._id,
        executedAt: { $gte: start, $lte: end }
    }).sort({ executedAt: -1 });

    let dayPnL = 0;
    let totalR = 0;
    let wins = 0;

    trades.forEach(t => {
        dayPnL += t.pnl;
        totalR += t.rMultiple || 0;
        if (t.pnl > 0) wins++;
    });

    const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;

    res.status(200).json({
        success: true,
        data: {
            date: dateStr,
            summary: {
                netPnL: `${dayPnL >= 0 ? '+' : '-'}$${Math.abs(dayPnL)}`,
                totalR: `${totalR >= 0 ? '+' : '-'}${totalR.toFixed(1)}R`,
                tradeCount: trades.length,
                winRate: `${winRate}%`
            },
            trades
        }
    });
});

// ==========================================
// 💡 BEHAVIORAL INSIGHTS ENGINE
// ==========================================

// @desc    Get AI Behavioral Performance Insights
// @route   GET /api/v1/psyche/journal/insights
// @access  Private
const getJournalInsights = asyncHandler(async (req, res) => {
    const trades = await Trade.find({ user: req.user._id });

    if (trades.length === 0) {
        return res.status(200).json({
            success: true,
            data: { insights: [] }
        });
    }

    const insights = [];

    const londonTrades = trades.filter(t => t.session === 'LONDON');
    if (londonTrades.length >= 3) {
        const londonWins = londonTrades.filter(t => t.pnl > 0).length;
        const londonWinRate = Math.round((londonWins / londonTrades.length) * 100);

        insights.push({
            id: 'london-session-leak',
            title: `Your London session win rate is ${londonWinRate}%`,
            description: `You perform significantly better during the London open (8–11am GMT). Consider focusing your trading sessions here and avoiding NY-only setups where your win rate drops.`
        });
    }

    const earlyExitTrades = trades.filter(t => t.closedEarly);
    if (earlyExitTrades.length > 0) {
        const totalMissedProfit = earlyExitTrades.reduce((sum, t) => sum + (t.missedProfit || 0), 0);
        const avgMissed = Math.round(totalMissedProfit / earlyExitTrades.length);

        insights.push({
            id: 'early-exit-leak',
            title: "You exit winning trades too early",
            description: `On ${earlyExitTrades.length} winning trades this month you closed before your take-profit — leaving an average of $${avgMissed} per trade on the table. Total missed profit: -$${totalMissedProfit}.`
        });
    }

    res.status(200).json({
        success: true,
        count: insights.length,
        data: { insights }
    });
});

// ==========================================
// 🎨 SOCIAL PNL SHARE CARD GENERATOR
// ==========================================

// @desc    Get Share Card Payload
// @route   GET /api/v1/psyche/journal/share-card
// @access  Private
const getPnLShareCardData = asyncHandler(async (req, res) => {
    const trades = await Trade.find({ user: req.user._id });

    let netPnL = 0;
    let totalWins = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalR = 0;

    trades.forEach(trade => {
        netPnL += trade.pnl;
        totalR += trade.rMultiple || 0;
        if (trade.pnl > 0) {
            totalWins += 1;
            grossProfit += trade.pnl;
        } else if (trade.pnl < 0) {
            grossLoss += Math.abs(trade.pnl);
        }
    });

    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0;
    const avgRR = totalTrades > 0 ? (totalR / totalTrades).toFixed(1) : "0.0";
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : "0.00";

    const formattedDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
    const formattedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

    res.status(200).json({
        success: true,
        data: {
            // FIX: Corrected mapping from username to userName to match UserSchema
            userHandle: `@${req.user.userName || 'trader'}`,
            timestamp: `${formattedDate} ${formattedTime}`,
            metrics: {
                netPnL: `${netPnL >= 0 ? '+' : '-'}$${Math.abs(netPnL)}`,
                winRate: `${winRate}%`,
                avgRR: `1 : ${avgRR}`,
                profitFactor: profitFactor
            },
            verificationUrl: `${process.env.PSYCHE_FRONTEND_URL}/journal/verify/${req.user._id}`
        }
    });
});

// @desc    Manually Add a Trade Log
// @route   POST /api/v1/psyche/journal/trades
// @access  Private
const addManualTrade = asyncHandler(async (req, res) => {
    const { pair, direction, lotSize, entryPrice, exitPrice, stopLoss, takeProfit, pnl, session, closedEarly, missedProfit } = req.body;

    if (!pair || !direction || !lotSize || !entryPrice || !exitPrice || pnl === undefined) {
        res.status(400);
        throw new Error("Please provide pair, direction, lot size, entry price, exit price, and PnL.");
    }

    const status = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN';

    let rMultiple = 0;
    if (stopLoss && stopLoss !== entryPrice) {
        const riskDistance = Math.abs(entryPrice - stopLoss);
        const rewardDistance = Math.abs(exitPrice - entryPrice);
        rMultiple = parseFloat((rewardDistance / riskDistance).toFixed(2));
        if (status === 'LOSS') rMultiple = -1.0;
    }

    const trade = await Trade.create({
        user: req.user._id,
        pair,
        direction,
        lotSize,
        entryPrice,
        exitPrice,
        stopLoss,
        takeProfit,
        pnl,
        rMultiple,
        status,
        session: session || 'LONDON',
        closedEarly: closedEarly || false,
        missedProfit: missedProfit || 0
    });

    res.status(201).json({
        success: true,
        data: trade
    });
});

module.exports = {
    connectBrokerAccount,
    syncAccountTrades,
    getJournalDashboard,
    getTradesForDay,
    getJournalInsights,
    getPnLShareCardData,
    addManualTrade
};