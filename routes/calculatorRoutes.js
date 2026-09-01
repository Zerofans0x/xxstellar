const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { 
    calculateRiskReward, 
    calculatePositionSize 
} = require('../controllers/calculatorController');

router.use(authenticate);

router.post('/risk-reward', calculateRiskReward);
router.post('/position-size', calculatePositionSize);

module.exports = router;