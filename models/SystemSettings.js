const mongoose = require('mongoose');

const SystemSettingsSchema = new mongoose.Schema({
    votingOpens: { type: String, default: 'Monday 00:00 GMT' },
    votingCloses: { type: String, default: 'Friday 16:00 GMT' },
    allowVoteChanges: { type: Boolean, default: true },
    notifyOnFlaggedContent: { type: Boolean, default: true },
    weeklyOutlookReminder: { type: Boolean, default: true },
    notifyOnVelocitySpikes: { type: Boolean, default: true },
    alertRecipients: { type: String, default: 'admin-team@psyweb.io' }
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', SystemSettingsSchema);