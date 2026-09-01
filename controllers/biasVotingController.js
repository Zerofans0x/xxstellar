const asyncHandler = require('express-async-handler');
const BiasInstrument = require('../models/BiasInstrument');
const BiasVote = require('../models/BiasVote');
const ModerationFlag = require('../models/ModerationFlag');

// Helper to get ISO Week String 
const getCurrentWeekIdentifier = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
};

// @desc    Get Market Insights & Bias Voting Dashboard
// @route   GET /api/v1/psyche/bias-voting
// @access  Private
const getBiasVotingDashboard = asyncHandler(async (req, res) => {
    const weekIdentifier = getCurrentWeekIdentifier();
    const instruments = await BiasInstrument.find({ isActive: true });
    
    // Fetch all votes for the current week
    const currentWeekVotes = await BiasVote.find({ weekIdentifier });
    const userVotes = await BiasVote.find({ weekIdentifier, user: req.user._id });
    
    const userVoteMap = {};
    userVotes.forEach(v => {
        userVoteMap[v.instrument.toString()] = v.vote;
    });

    let totalGlobalVotes = currentWeekVotes.length;
    let globalBullCount = 0;
    let globalBearCount = 0;

    const formattedInstruments = instruments.map(inst => {
        const instVotes = currentWeekVotes.filter(v => v.instrument.toString() === inst._id.toString());
        const total = instVotes.length;

        const bullCount = instVotes.filter(v => v.vote === 'BULL').length;
        const neutralCount = instVotes.filter(v => v.vote === 'NEUTRAL').length;
        const bearCount = instVotes.filter(v => v.vote === 'BEAR').length;

        globalBullCount += bullCount;
        globalBearCount += bearCount;

        const bullPercent = total > 0 ? Math.round((bullCount / total) * 100) : 0;
        const neutralPercent = total > 0 ? Math.round((neutralCount / total) * 100) : 0;
        const bearPercent = total > 0 ? Math.round((bearCount / total) * 100) : 0;

        return {
            id: inst._id,
            symbol: inst.symbol,
            assetClass: inst.assetClass,
            currentPrice: inst.currentPrice,
            changePercent: inst.changePercent,
            totalVotes: total,
            breakdown: {
                bullPercent,
                neutralPercent,
                bearPercent
            },
            userVote: userVoteMap[inst._id.toString()] || null,
            statusText: `${bullPercent}% of ${total.toLocaleString()} voters are bullish on ${inst.symbol} this week`
        };
    });

    // Sidebar Community Summary
    const nonNeutralVotes = globalBullCount + globalBearCount;
    const overallBullish = nonNeutralVotes > 0 ? Math.round((globalBullCount / nonNeutralVotes) * 100) : 50;
    const overallBearish = nonNeutralVotes > 0 ? 100 - overallBullish : 50;

    res.status(200).json({
        success: true,
        data: {
            weekIdentifier,
            totalVotesCast: totalGlobalVotes,
            communityOverview: {
                overallBullishPercent: overallBullish,
                overallBearishPercent: overallBearish,
                totalVotes: totalGlobalVotes
            },
            instruments: formattedInstruments
        }
    });
});

// @desc    Cast or Update Bias Vote
// @route   POST /api/v1/psyche/bias-voting/:instrumentId/vote
// @access  Private
const castBiasVote = asyncHandler(async (req, res) => {
    const { vote, reasonChip } = req.body;
    const { instrumentId } = req.params;

    if (!['BULL', 'NEUTRAL', 'BEAR'].includes(vote)) {
        res.status(400);
        throw new Error("Invalid vote option. Allowed: BULL, NEUTRAL, BEAR.");
    }

    const instrument = await BiasInstrument.findById(instrumentId);
    if (!instrument) {
        res.status(404);
        throw new Error("Instrument not found.");
    }

    const weekIdentifier = getCurrentWeekIdentifier();

    const updatedVote = await BiasVote.findOneAndUpdate(
        { user: req.user._id, instrument: instrumentId, weekIdentifier },
        { $set: { vote, reasonChip: reasonChip || '' } },
        { upsert: true, returnDocument: 'after' }
    );

    res.status(200).json({
        success: true,
        message: `Vote recorded for ${instrument.symbol}`,
        data: updatedVote
    });
});

// @desc    Report a Custom Chip or Issue to Moderation Queue
// @route   POST /api/v1/psyche/bias-voting/report
// @access  Private
const reportReasonChip = asyncHandler(async (req, res) => {
    const { title, subtitle, type } = req.body;

    if (!title || !subtitle) {
        res.status(400);
        throw new Error("Title and subtitle are required for reporting.");
    }

    const flag = await ModerationFlag.create({
        title,
        subtitle,
        type: type || 'CUSTOM_CHIP_SPAM',
        status: 'PENDING'
    });

    res.status(201).json({
        success: true,
        message: "Report submitted for admin moderation.",
        data: flag
    });
});

module.exports = {
    getBiasDashboard: getBiasVotingDashboard,
    castBiasVote,
    reportReasonChip
};