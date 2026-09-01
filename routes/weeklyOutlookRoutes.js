const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { 
    getWeeklyOutlooks, 
    getWeeklyOutlookById, 
    updateWatchProgress 
} = require('../controllers/weeklyOutlookController');

router.use(authenticate);

router.get('/', getWeeklyOutlooks);
router.get('/:id', getWeeklyOutlookById);
router.post('/:id/progress', updateWatchProgress);

module.exports = router;