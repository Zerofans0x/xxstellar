// File: routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { 
    subscribeToPlanCrypto, 
    verifySubscriptionCrypto 
} = require('../controllers/subscriptionController');
const { authenticate } = require('../middleware/authMiddleware'); // Assuming you use auth protection middleware

router.post('/crypto/subscribe', authenticate, subscribeToPlanCrypto);
router.post('/crypto/verify', authenticate, verifySubscriptionCrypto);

module.exports = router;