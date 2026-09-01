const asyncHandler = require('express-async-handler');
const WeeklyOutlook = require('../../models/WeeklyOutlook');

// @desc    Create / Post New Weekly Outlook Video
// @route   POST /api/v1/admin/weekly-outlook
// @access  Private/Admin
const createWeeklyOutlook = asyncHandler(async (req, res) => {
    const { title, speaker, month, year, thumbnailUrl, videoUrl, durationMinutes, overview, isFeatured } = req.body;

    if (!title || !thumbnailUrl || !videoUrl || !overview) {
        res.status(400);
        throw new Error("Please provide title, thumbnail URL, video stream URL, and overview description.");
    }

    // If marked as featured, unset previous featured videos
    if (isFeatured) {
        await WeeklyOutlook.updateMany({}, { isFeatured: false });
    }

    const outlook = await WeeklyOutlook.create({
        title,
        speaker: speaker || 'Emrld',
        month: month || new Date().toLocaleString('en-US', { month: 'long' }),
        year: year || new Date().getFullYear(),
        thumbnailUrl,
        videoUrl,
        durationMinutes: durationMinutes || 15,
        overview,
        isFeatured: isFeatured || false
    });

    res.status(201).json({
        success: true,
        data: outlook
    });
});

// @desc    Delete a Weekly Outlook
// @route   DELETE /api/v1/admin/weekly-outlook/:id
// @access  Private/Admin
const deleteWeeklyOutlook = asyncHandler(async (req, res) => {
    const outlook = await WeeklyOutlook.findById(req.params.id);

    if (!outlook) {
        res.status(404);
        throw new Error("Weekly outlook record not found.");
    }

    await outlook.deleteOne();

    res.status(200).json({
        success: true,
        message: "Weekly outlook video removed."
    });
});

module.exports = {
    createWeeklyOutlook,
    deleteWeeklyOutlook
};