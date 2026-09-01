const asyncHandler = require('express-async-handler');
const ModerationFlag = require('../../models/ModerationFlag');

// @desc    Get Flagged Review Items for Moderation Queue
// @route   GET /api/v1/admin/moderation
// @access  Private/Admin
const getModerationQueue = asyncHandler(async (req, res) => {
    const flags = await ModerationFlag.find({ status: { $ne: 'DISMISSED' } }).sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: flags.length,
        data: flags
    });
});

// @desc    Take Action on Flagged Item (Dismiss, Remove, Investigate, Resolve)
// @route   PATCH /api/v1/admin/moderation/:id/action
// @access  Private/Admin
const takeModerationAction = asyncHandler(async (req, res) => {
    const { action } = req.body; // 'DISMISS', 'REMOVE', 'INVESTIGATE', 'RESOLVE'
    const flag = await ModerationFlag.findById(req.params.id);

    if (!flag) {
        res.status(404);
        throw new Error("Moderation record not found.");
    }

    if (action === 'DISMISS') flag.status = 'DISMISSED';
    else if (action === 'REMOVE') flag.status = 'REMOVED';
    else if (action === 'INVESTIGATE') flag.status = 'INVESTIGATING';
    else if (action === 'RESOLVE') flag.status = 'RESOLVED';
    else {
        res.status(400);
        throw new Error("Invalid action type.");
    }

    await flag.save();

    res.status(200).json({
        success: true,
        message: `Moderation item updated to ${flag.status}.`,
        data: flag
    });
});

module.exports = {
    getModerationQueue,
    takeModerationAction
};