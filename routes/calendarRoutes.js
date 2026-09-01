const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { 
    getCalendarEvents,
    syncLiveCalendarEvents 
} = require('../controllers/calendarController');

router.use(authenticate);

router.get('/', getCalendarEvents);
router.post('/sync-live', syncLiveCalendarEvents); // New route for live sync

module.exports = router;