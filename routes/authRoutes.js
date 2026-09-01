const express = require('express');
const passport = require('passport');
const router = express.Router();
const {
    registerUser,
    loginUser,
    getMe,
    googleCallback,
    logoutUser,
    refreshToken,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    changePassword,
} = require('../controllers/authController');

const {
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validateResetPassword,
    validateVerifyEmail,
    validateResendVerificationEmail,
    validateChangePassword,
} = require('../validations/authValidator');

const { authLimiter } = require('../middleware/ratelimiters');
const { authenticate } = require('../middleware/authMiddleware');

// --- Utility Routes ---
router.get('/me', authenticate, getMe);

// --- Auth Routes ---
router.post('/register', validateRegister, authLimiter, registerUser);
router.post('/login', validateLogin, authLimiter, loginUser);
router.post('/logout', authenticate, logoutUser);
router.post('/refresh-token', refreshToken); 

// // --- Google OAuth Routes ---
// router.get('/google', (req, res, next) => {
//     const state = req.query.state; 
//     const authenticator = passport.authenticate('google', { 
//         scope: ['profile', 'email'],
//         state: state 
//     });
//     authenticator(req, res, next);
// });

// router.get('/google/callback', 
//     passport.authenticate('google', { failureRedirect: '/login/failed', session: false }),
//     googleCallback
// );

// 1. Trigger Google Login
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2. Google Callback
router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    googleCallback
);

// --- Verification & Password Management ---
router.post('/verify-email', validateVerifyEmail, verifyEmail);
router.post('/resend-verification', validateResendVerificationEmail, authLimiter, resendVerificationEmail);

router.post('/forgot-password', validateForgotPassword, authLimiter, forgotPassword);

// 🟢 CHANGED to POST (Standard for submitting forms)
router.post('/reset-password', validateResetPassword, resetPassword);

// Authenticated Password Change
router.put('/change-password', authenticate, validateChangePassword, changePassword);

module.exports = router;