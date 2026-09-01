const asyncHandler = require('express-async-handler');
const WeeklyOutlook = require('../models/WeeklyOutlook');
const OutlookProgress = require('../models/OutlookProgress');

// @desc    Get Weekly Outlook Dashboard (Hero Featured + Grid History)
// @route   GET /api/v1/psyche/weekly-outlook
// @access  Private
const getWeeklyOutlooks = asyncHandler(async (req, res) => {
    // 1. Fetch published outlooks sorted by publish date
    const outlooks = await WeeklyOutlook.find({ isPublished: true }).sort({ publishedAt: -1 });

    if (outlooks.length === 0) {
        return res.status(200).json({
            success: true,
            data: { hero: null, recent: [], archive: [] }
        });
    }

    // 2. Identify Hero video (explicitly featured, or fall back to the latest video)
    let hero = outlooks.find(o => o.isFeatured) || outlooks[0];
    
    // 3. Separate remaining videos for the middle highlights and bottom archive grid
    const remaining = outlooks.filter(o => o._id.toString() !== hero._id.toString());
    const recent = remaining.slice(0, 2); // Top 2 next to hero
    const archive = remaining.slice(2);  // Grid items below

    // 4. Attach watch progress for the current user
    const userProgress = await OutlookProgress.find({ user: req.user._id });
    const progressMap = {};
    userProgress.forEach(p => {
        progressMap[p.outlook.toString()] = p.progressPercent;
    });

    const formatOutlookItem = (item) => ({
        id: item._id,
        title: item.title,
        speaker: item.speaker,
        month: item.month,
        thumbnailUrl: item.thumbnailUrl,
        durationMinutes: item.durationMinutes,
        progressPercent: progressMap[item._id.toString()] || 0,
        publishedAt: item.publishedAt
    });

    res.status(200).json({
        success: true,
        data: {
            hero: formatOutlookItem(hero),
            recent: recent.map(formatOutlookItem),
            archive: archive.map(formatOutlookItem)
        }
    });
});

// @desc    Get Single Weekly Outlook Video details for Player
// @route   GET /api/v1/psyche/weekly-outlook/:id
// @access  Private
const getWeeklyOutlookById = asyncHandler(async (req, res) => {
    const outlook = await WeeklyOutlook.findById(req.params.id);

    if (!outlook || !outlook.isPublished) {
        res.status(404);
        throw new Error("Weekly outlook video not found.");
    }

    let progress = await OutlookProgress.findOne({ user: req.user._id, outlook: outlook._id });

    res.status(200).json({
        success: true,
        data: {
            id: outlook._id,
            title: outlook.title,
            speaker: outlook.speaker,
            videoUrl: outlook.videoUrl,
            durationMinutes: outlook.durationMinutes,
            overview: outlook.overview,
            userProgress: {
                progressPercent: progress ? progress.progressPercent : 0,
                lastPositionSeconds: progress ? progress.lastPositionSeconds : 0,
                isCompleted: progress ? progress.isCompleted : false
            }
        }
    });
});

// @desc    Save Video Watch Progress (Called periodically by video player)
// @route   POST /api/v1/psyche/weekly-outlook/:id/progress
// @access  Private
const updateWatchProgress = asyncHandler(async (req, res) => {
    const { progressPercent, lastPositionSeconds } = req.body;

    const isCompleted = progressPercent >= 90;

    const progress = await OutlookProgress.findOneAndUpdate(
        { user: req.user._id, outlook: req.params.id },
        { 
            $set: { 
                progressPercent, 
                lastPositionSeconds, 
                isCompleted 
            } 
        },
        { upsert: true, returnDocument: 'after' }
    );

    res.status(200).json({
        success: true,
        data: progress
    });
});

module.exports = {
    getWeeklyOutlooks,
    getWeeklyOutlookById,
    updateWatchProgress
};