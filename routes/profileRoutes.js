const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware'); // Assuming you have this
const upload = require('../middleware/uploadMiddleware'); 

const {
    getProfile,
    updateAvatar,
    cancelSubscription,
    requestSensitiveOTP,
    updateWalletAddress,
    requestWithdrawal,
    getFinancialHistory,
    deleteAccount,
    updateProfile,
    getWalletStats,
} = require('../controllers/profileController');

// Basics
router.get('/', authenticate, getProfile);
router.put('/update', authenticate, updateProfile);
router.get('/wallet-stats', authenticate, getWalletStats);
router.put('/avatar', authenticate, upload.single('avatar'), updateAvatar);
router.delete('/delete', authenticate, deleteAccount);

// Subscription
router.post('/subscription/cancel', authenticate, cancelSubscription);

// Wallet & Security
router.post('/otp/request', authenticate, requestSensitiveOTP);
router.put('/wallet', authenticate, updateWalletAddress); // Needs OTP in body
router.post('/withdraw', authenticate, requestWithdrawal); // Needs OTP in body
router.get('/financials', authenticate, getFinancialHistory);

module.exports = router;