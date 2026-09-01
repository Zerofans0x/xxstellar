const { body, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Define rules for registration
const validateRegister = [
    body('firstName')
        .notEmpty().withMessage('First name is required.')
        .isString().withMessage('First name must be a string.')
        .trim()
        .escape(),

    body('lastName')
        .notEmpty().withMessage('Last name is required.')
        .isString().withMessage('Last name must be a string.')
        .trim()
        .escape(),        

    body('email')
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Please provide a valid email address.')
        .normalizeEmail(),

    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number.'),

        body('intent')
        .optional()
        .isIn(['investor', 'institutional', 'trader']).withMessage('Invalid user intent.'),  

    body('referralCode')
        .optional()
        .trim()
        .escape(),


    handleValidationErrors
];

// Define rules for login
const validateLogin = [
    body('email')
        .isEmail().withMessage('Please provide a valid email.')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required.'),
    handleValidationErrors
];

// Define rules for Forgot Password (OTP Request)
const validateForgotPassword = [
    body('email')
        .isEmail().withMessage('Please provide a valid email.')
        .normalizeEmail(),
    handleValidationErrors
];

// 🔴 FIXED: Reset Password (Now checks for Email + Code + New Password)
const validateResetPassword = [
    body('email')
        .isEmail().withMessage('Email is required.')
        .normalizeEmail(),

    body('code')
        .notEmpty().withMessage('Reset code is required.')
        .isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits.'),

    body('password')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number.'),

    handleValidationErrors
];

// 🔴 FIXED: Verify Email (Now checks for Email + Code)
const validateVerifyEmail = [
    body('email')
        .isEmail().withMessage('Email is required.')
        .normalizeEmail(),

    body('code')
        .notEmpty().withMessage('Verification code is required.')
        .isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits.'),

    handleValidationErrors
];

// Define rules for resend verification email
const validateResendVerificationEmail = [
    body('email')
        .isEmail().withMessage('Please provide a valid email.')
        .normalizeEmail(),
    handleValidationErrors
];

// Define rules for Google OAuth
const validateGoogleAuth = [
    query('intent')
        .notEmpty().withMessage('Auth intent is required.')
        .isIn(['trader']).withMessage('Invalid auth intent specified.'),
    handleValidationErrors
];

// Define rules for logout
const validateLogout = [
    handleValidationErrors
];

// Define rules for refresh token
const validateRefreshToken = [
    handleValidationErrors
];

// Define rules for social login
const validateSocialLogin = [
    body('provider')
        .notEmpty().withMessage('Social login provider is required.')
        .isIn(['google', 'facebook', 'twitter']).withMessage('Invalid social login provider.'),
    body('token')
        .notEmpty().withMessage('Social login token is required.'),
    handleValidationErrors
];

// Define rules for change password
const validateChangePassword = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required.'),
    body('newPassword')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number.'),
    handleValidationErrors
];

module.exports = {
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validateResetPassword,
    validateVerifyEmail,
    validateResendVerificationEmail,
    validateLogout,
    validateRefreshToken,
    validateSocialLogin,
    validateGoogleAuth,
    validateChangePassword,
};