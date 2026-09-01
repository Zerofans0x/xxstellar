const AuditLog = require('../models/AuditLog');

const createAuditLog = async ({ initiatorId = null, initiatorName, action, category, status, metadata }) => {
    try {
        await AuditLog.create({
            initiatorId,
            initiatorName,
            action,
            category,
            status,
            metadata
        });
    } catch (error) {
        console.error("Failed to write to Audit Log:", error);
    }
};

module.exports = { createAuditLog };