const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');

const {
    saveOnboarding
} = require('../controllers/stellartermController');

const { getTerminalData } = require('../controllers/dashboardController');

router.post('/onboarding', authenticate, saveOnboarding); 


// Dashboard endpoints
router.get('/terminal', authenticate, getTerminalData);

module.exports = router;