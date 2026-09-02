
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const InvestorProfile = require('../models/InvestorProfile'); 
const generateTokens = require('../utils/generateTokens');
const { MAX_LOGIN_ATTEMPTS, LOCK_TIME } = require('../config/constants');
const { sendEmail } = require('../services/emailService');

// --- HELPER: Generate 6-Digit OTP ---
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// --- HELPER: Hash OTP ---
const hashOTP = (otp) => {
    return crypto.createHash('sha256').update(otp.toString()).digest('hex');
};

// --- HELPER: Unified Cookie Options ---
const getCookieOptions = (customMaxAge) => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        expires: new Date(Date.now() + (customMaxAge || 7 * 24 * 60 * 60 * 1000)),
        httpOnly: true,
        path: '/',
        // Do not force a root domain on localhost, otherwise browsers drop cookies
        domain: isProduction ? process.env.STELLARTERM_ROOT_DOMAIN : undefined,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
    };
};

// --- Send Token Response ---
const sendTokenResponse = async (user, statusCode, res, redirectOverride) => {
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    const isOnboarded = !!(await InvestorProfile.exists({ user: user._id }));

    const refreshCookieOptions = getCookieOptions(7 * 24 * 60 * 60 * 1000);
    const accessCookieOptions = getCookieOptions(15 * 60 * 1000);

    res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    res.cookie('accessToken', accessToken, accessCookieOptions);

    if (redirectOverride) {
        const frontendUrl = process.env.STELLARTERM_FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}${redirectOverride}`);
    }
    
    res.status(statusCode).json({
        success: true,
        isOnboarded: user.isOnboarded,
        isEmailVerified: user.isEmailVerified,
        user: { 
            id: user._id, 
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role, 
            referralCode: user.referralCode,
        },
        tokens: { accessToken, refreshToken }
    });
};

// --- REFRESH TOKEN ---
const refreshToken = asyncHandler(async (req, res) => {
    let token = req.cookies.refreshToken;
    if (!token && req.body.refreshToken) token = req.body.refreshToken;

    if (!token) { res.status(401); throw new Error('Not authorized, no refresh token provided.'); }

    try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.id);

        if (!user || user.status !== 'active') {
            res.status(401); throw new Error('User not found or account is inactive.');
        }

        const { accessToken, refreshToken: newRefreshToken } = generateTokens(user._id, user.role); 
        
        const refreshCookieOptions = getCookieOptions(7 * 24 * 60 * 60 * 1000);
        const accessCookieOptions = getCookieOptions(15 * 60 * 1000);

        res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);
        res.cookie('accessToken', accessToken, accessCookieOptions);

        res.status(200).json({ 
            message: 'Token refreshed',
            tokens: { accessToken, refreshToken: newRefreshToken }
        });

    } catch (error) {
        res.status(401); throw new Error('Not authorized, token failed or user session is invalid.');
    }
});

// --- REGISTER USER ---
const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password, intent, referralCode } = req.body; 
    
    const userExists = await User.findOne({ email });
    if (userExists) { res.status(400); throw new Error('User with this email already exists.'); }

    let referrerId = null;
    if (referralCode) {
        const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
        if (referrer) referrerId = referrer._id;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    let userRole = (intent === 'institutional') ? 'institutional' : 'investor';

    const otp = generateOTP();
    const hashedOTP = hashOTP(otp); 

    const user = await User.create({
        firstName,
        lastName,
        email,
        passwordHash,
        authMethod: 'local',
        role: userRole,
        referredBy: referrerId, 
        emailVerificationToken: hashedOTP,
        emailVerificationTokenExpires: Date.now() + 15 * 60 * 1000,
    });

    sendEmail({
        subject: 'Verify Your StellarTerm Account', 
        send_to: user.email,
        sent_from: "StellarTerm <support@mystellarterm.com>",
        reply_to: "support@mystellarterm.com",
        templateKey: process.env.ZEPTO_TEMPLATE_VERIFY,
        extraParams: { name: user.firstName, code: otp, action_url: '#' }
    }).catch(err => console.error("Verification Email fail:", err));

    res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email for the verification code.',
        email: user.email
    });
});

// --- LOGIN USER ---
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash +lockUntil +loginAttempts');

    if (!user) { res.status(401); throw new Error('Invalid email or password.'); }

    if (user.isLocked()) {
        res.status(423); throw new Error('Account locked.');
    }

    if (await user.matchPassword(password)) {
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLogin = Date.now();
        await user.save();
        
        if (!user.isEmailVerified) { return res.status(403).json({ error: 'EMAIL_NOT_VERIFIED' }); }

        await sendTokenResponse(user, 200, res);
    } else {
        user.loginAttempts += 1;
        if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            user.lockUntil = new Date(Date.now() + LOCK_TIME);
            user.loginAttempts = 0;
        }
        await user.save();
        res.status(401); throw new Error('Invalid email or password.'); 
    }
});

// --- VERIFY EMAIL ---
const verifyEmail = asyncHandler(async (req, res) => {
    const { email, code } = req.body; 

    if (!email || !code) { res.status(400); throw new Error('Email and Verification Code are required.'); }

    const user = await User.findOne({ email }).select('+emailVerificationToken +emailVerificationTokenExpires');

    if (!user) { res.status(404); throw new Error('User not found.'); }

    const hashedInput = hashOTP(code);

    if (
        user.emailVerificationToken !== hashedInput || 
        !user.emailVerificationTokenExpires ||
        user.emailVerificationTokenExpires < Date.now()
    ) {
        res.status(400); throw new Error('Invalid or expired verification code.');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    await user.save();

    await sendTokenResponse(user, 200, res); 
});

// --- RESEND VERIFICATION ---
const resendVerificationEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        res.status(400);
        throw new Error('Email is required.');
    }

    const user = await User.findOne({ email });

    if (!user) {
        return res.status(200).json({ message: 'Verification code sent.' });
    }

    if (user.isEmailVerified) { 
        res.status(400); 
        throw new Error('Account already verified.'); 
    }

    const otp = generateOTP();
    user.emailVerificationToken = hashOTP(otp); 
    user.emailVerificationTokenExpires = Date.now() + 15 * 60 * 1000;
    await user.save();
    
    try {
        await sendEmail({
            subject: 'Resend: Verification Code',
            send_to: user.email,
            sent_from: "StellarTerm <support@mystellarterm.com>",
            reply_to: "support@mystellarterm.com",
            templateKey: process.env.ZEPTO_TEMPLATE_VERIFY,
            extraParams: { name: user.firstName, code: otp }
        });
        res.status(200).json({ message: 'Verification code sent.' });
    } catch (error) {
        res.status(500); throw new Error('Email could not be sent.');
    }
});

// --- FORGOT PASSWORD ---
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email }).select('+lockUntil');

    if (!user) return res.status(200).json({ message: 'Reset code sent if account exists.' });
    if (user.isLocked()) { res.status(423); throw new Error(`Account locked.`); }

    const otp = generateOTP();
    user.resetPasswordToken = hashOTP(otp); 
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();
    
    try {
        await sendEmail({
            subject: 'Reset Your Password Code',
            send_to: user.email,
            sent_from: "StellarTerm <support@mystellarterm.com>",
            reply_to: "support@mystellarterm.com",
            templateKey: process.env.ZEPTO_TEMPLATE_RESET,
            extraParams: { name: user.firstName, code: otp }
        });
        res.status(200).json({ message: 'Reset code sent if account exists.' });
    } catch (error) { 
        res.status(500); throw new Error('Email could not be sent.');
    }
});

// --- RESET PASSWORD ---
const resetPassword = asyncHandler(async (req, res) => {
    const { email, code, password } = req.body; 

    const user = await User.findOne({ 
        email,
        resetPasswordExpires: { $gt: Date.now() } 
    }).select('+resetPasswordToken');

    if (!user) { res.status(400); throw new Error('Invalid code or user not found.'); }

    const hashedInput = hashOTP(code);

    if (user.resetPasswordToken !== hashedInput) {
        res.status(400); throw new Error('Invalid verification code.');
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    await sendTokenResponse(user, 200, res);
});

// --- OAUTH CALLBACKS ---
const googleCallback = asyncHandler(async (req, res) => {
    await sendTokenResponse(req.user, 200, res, '/dashboard'); 
});

const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (user) {
        const isOnboarded = !!(await InvestorProfile.exists({ user: user._id }));
        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            isOnboarded: isOnboarded
        });
    } else { res.status(404); throw new Error('User not found'); }
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+passwordHash');
    if (!user) { res.status(404); throw new Error('User not found.'); }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) { res.status(401); throw new Error('Incorrect current password.'); }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.status(200).json({ message: 'Password changed successfully.' });
});

const logoutUser = asyncHandler(async (req, res) => {
    const clearOptions = getCookieOptions(0);
    res.cookie('refreshToken', '', { ...clearOptions, expires: new Date(0) });
    res.cookie('accessToken', '', { ...clearOptions, expires: new Date(0) });
    if (req.session) { req.session.destroy(); }
    res.status(200).json({ message: 'Logout successful' });
});

module.exports = {
    registerUser,
    loginUser,
    googleCallback,
    refreshToken,
    getMe,
    logoutUser,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    changePassword,
};