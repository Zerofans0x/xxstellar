const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');

const {
    saveOnboarding
} = require('../controllers/stellartermController');

// const { getDashboardHome } = require('../controllers/dashboardController');

router.post('/onboarding', authenticate, saveOnboarding); 

// // 🛡️ Apply authentication to all student routes
// router.use(authenticate);
// router.get('/dashboard', getDashboardHome);

module.exports = router;