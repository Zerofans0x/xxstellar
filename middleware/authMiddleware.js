const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const authenticate = asyncHandler(async (req, res, next) => {
    let token;

    // 1. Extract Token
    if (req.cookies.accessToken) {
        token = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token provided');
    }

    // 2. Verify Token (Isolated Try/Catch)
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (error) {
        res.status(401);
        throw new Error('Not authorized, token failed');
    }

    // 3. Check DB (Fixes Ghost User Bug)
    // We select specifically what we need to minimize DB load
    const user = await User.findById(decoded.id).select('_id role status isEmailVerified email');

    if (!user || user.status !== 'active') {
        res.status(401);
        throw new Error('User not found or account is inactive.');
    }

    // 4. Check Email Verification (Specific Error)
    if (!user.isEmailVerified) {
        res.status(403);
        throw new Error('Access denied. Please verify your email address to continue.');
    }

    req.user = user;
    next();
});

// Authorize remains the same
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403);
            throw new Error(`Forbidden: You do not have the required '${roles.join(' or ')}' role.`);
        }
        next();
    };
};

module.exports = { authenticate, authorize };