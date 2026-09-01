const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../../middleware/authMiddleware');
const { 
    getModerationQueue, 
    takeModerationAction 
} = require('../../controllers/admin/adminModerationController');

// Protect all moderation routes with auth and admin authorization
router.use(authenticate);
router.use(authorize('admin', 'superadmin'));

// @route   GET /api/v1/admin/moderation
router.get('/', getModerationQueue);

// @route   PATCH /api/v1/admin/moderation/:id/action
router.patch('/:id/action', takeModerationAction);

module.exports = router;