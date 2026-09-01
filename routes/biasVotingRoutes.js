const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { 
    getBiasDashboard, 
    castBiasVote, 
    reportReasonChip 
} = require('../controllers/biasVotingController');

// All bias voting routes require student authentication
router.use(authenticate);

// @route   GET /api/v1/psyche/bias-voting
router.get('/', getBiasDashboard);

// @route   POST /api/v1/psyche/bias-voting/:instrumentId/vote
router.post('/:instrumentId/vote', castBiasVote);

// @route   POST /api/v1/psyche/bias-voting/report
router.post('/report', reportReasonChip);

module.exports = router;