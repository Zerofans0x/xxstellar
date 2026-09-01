const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const RadarProfile = require('../models/RadarProfile');
const crypto = require('crypto');
const { sendEmail } = require('../services/emailService');
const fs = require('fs');
const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../config/s3');
const path = require('path');

// --- HELPER: Upload Avatar to S3 ---
const uploadAvatarToS3 = async (filePath, filename) => {
    const fileBuffer = fs.readFileSync(filePath);
    // Resize to square for avatars
    const resizedBuffer = await sharp(fileBuffer)
        .resize({ width: 400, height: 400, fit: 'cover' }) 
        .jpeg({ quality: 80 }) 
        .toBuffer();

    const bucketName = 'setupradar-strats-bucket'; // Or your public bucket
    const key = `avatars/${Date.now()}_${path.basename(filename)}`;
    
    await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: resizedBuffer,
        ContentType: 'image/jpeg'
    }));

    fs.unlinkSync(filePath); // Cleanup
    return `https://${bucketName}.s3.eu-west-1.amazonaws.com/${key}`;
};

// --- HELPER: Generate OTP ---
const generateOTP = async (user) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    // Hash it for storage
    user.sensitiveActionToken = crypto.createHash('sha256').update(otp).digest('hex');
    user.sensitiveActionExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();
    return otp;
};

// @desc    Get Full Profile (Includes Referral Link & Earnings)
const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    
    // 1. Generate Referral Code if missing
    if (!user.referralCode) {
        user.referralCode = user.firstName.substring(0, 3).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
        await user.save();
    }

    // 2. Construct Link
    const referralLink = `https://setupradar.app/register?ref=${user.referralCode}`;

    // 3. Calculate Lifetime Earnings (Total Earned)
    // Logic: Sum of ALL 'commission_credit' transactions ever
    const allCommissions = await Transaction.aggregate([
        { 
            $match: { 
                user: user._id, 
                type: 'commission_credit' 
            } 
        },
        { 
            $group: { 
                _id: null, 
                total: { $sum: "$amount" } 
            } 
        }
    ]);

    const totalEarnedCents = allCommissions.length > 0 ? allCommissions[0].total : 0;

    res.status(200).json({
        user: {
            fullName: user.fullName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            memberSince: user.createdAt,
            referralCode: user.referralCode,
            referralLink: referralLink 
        },
        subscription: {
            plan: user.subscription.plan,
            status: user.subscription.status,
            expiryDate: user.subscription.expiryDate,
            autoRenew: user.subscription.autoRenew
        },
        wallet: {
            balance: user.walletBalance, // In Cents
            totalEarned: totalEarnedCents, // In Cents (New Field)
            address: user.cryptoWalletAddress,
            network: user.walletNetwork 
        },
        stats: {
            totalReferrals: await User.countDocuments({ referredBy: user._id })
        }
    });
});

// @desc    Get Wallet Stats (Balance, Pending, Cleared, Total Earned)
// @route   GET /api/v1/profile/wallet/stats
const getWalletStats = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    
    // 1. Calculate Pending (Un-cleared) Commissions
    // Logic: Commissions older than 5 days are "Cleared". Newer are "Pending".
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const pendingTxs = await Transaction.find({
        user: user._id,
        type: 'commission_credit',
        createdAt: { $gt: fiveDaysAgo } // Created AFTER 5 days ago (Newer)
    });

    const pendingAmountCents = pendingTxs.reduce((sum, tx) => sum + tx.amount, 0);

    // 2. Calculate Lifetime Earnings (Total Earned)
    // Logic: Sum of ALL 'commission_credit' transactions ever, regardless of date or withdrawal status.
    const allCommissions = await Transaction.aggregate([
        { 
            $match: { 
                user: user._id, 
                type: 'commission_credit' 
            } 
        },
        { 
            $group: { 
                _id: null, 
                total: { $sum: "$amount" } 
            } 
        }
    ]);

    const totalEarnedCents = allCommissions.length > 0 ? allCommissions[0].total : 0;

    res.status(200).json({
        // Convert Cents to Dollars for Frontend
        currentBalance: user.walletBalance / 100, 
        
        pendingBalance: pendingAmountCents / 100,
        
        // Available = What they can actually withdraw right now
        // (Current Balance - Pending Holds)
        availableBalance: (user.walletBalance - pendingAmountCents) / 100,

        // 🌟 TASK 6 DONE: Lifetime Earnings
        totalEarned: totalEarnedCents / 100,

        currency: 'USD',
        network: user.walletNetwork || 'TRC20',
        address: user.cryptoWalletAddress || ''
    });
});


// @desc    Update User Profile (Smart Name Logic)
// @route   PUT /api/v1/profile/update
const updateProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // --- 1. SMART NAME UPDATE LOGIC ---
    // If user sends "fullName", we auto-split it (Just like Register)
    if (req.body.fullName) {
        const full = req.body.fullName.trim();
        const nameParts = full.split(/\s+/);
        
        user.fullName = full;
        user.firstName = nameParts[0];
        // Join the rest as Last Name (e.g. "Sodiq Baki Junior" -> Last: "Baki Junior")
        user.lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    } 
    // Fallback: If they send separate fields instead
    else {
        if (req.body.firstName) user.firstName = req.body.firstName;
        if (req.body.lastName) user.lastName = req.body.lastName;
        
        // Reconstruct fullName if individual parts changed
        if (req.body.firstName || req.body.lastName) {
            user.fullName = `${user.firstName} ${user.lastName}`.trim();
        }
    }

    // --- 2. Update Other Fields ---
    if (req.body.phone) user.phone = req.body.phone;
    // Add other editable fields here as needed (e.g., bio, country)

    const updatedUser = await user.save();

    res.status(200).json({
        success: true,
        user: {
            id: updatedUser._id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            fullName: updatedUser.fullName,
            email: updatedUser.email,
            avatarUrl: updatedUser.avatarUrl,
            phone: updatedUser.phone
        },
        message: "Profile updated successfully"
    });
});

// @desc    Delete Account
// @route   DELETE /api/v1/profile/delete
const deleteAccount = asyncHandler(async (req, res) => {
    const { confirmation, reason } = req.body; 
    
    // 1. Validation: Check for exact word "DELETE"
    if (confirmation !== 'DELETE') {
        res.status(400); 
        throw new Error("Please type 'DELETE' in all caps to confirm.");
    }

    const user = await User.findById(req.user.id);
    if (!user) { res.status(404); throw new Error("User not found"); }

    // 2. Soft Delete
    user.status = 'suspended'; 
    
    // Obfuscate email so they can't login, but we keep history
    // We append timestamp to ensure uniqueness if they register again later
    user.email = `deleted_${Date.now()}_${user.email}`; 
    
    // Add deletion reason to User model (Ensure schema supports this or use flexible schema)
    // If you haven't added 'deletionReason' to User.js model, this line won't save. 
    // You can just log it for now:
    console.log(`User ${user._id} deleted account. Reason: ${reason}`);

    await user.save();

    // 3. Disable Radar
    await RadarProfile.findOneAndUpdate({ user: user._id }, { isOn: false });

    // ⚡️ Socket
    const io = req.app.get('io');
    if(io) io.to(user._id).emit('system_update', { type: 'ACCOUNT_DELETED' });

    res.status(200).json({ message: "Account deleted successfully." });
});

// @desc    Update Avatar
// @route   PUT /api/v1/profile/avatar
const updateAvatar = asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400); throw new Error('No image file provided');
    }
    
    const user = await User.findById(req.user.id);
    const url = await uploadAvatarToS3(req.file.path, req.file.originalname);
    
    user.avatarUrl = url;
    await user.save();

    res.status(200).json({ avatarUrl: url });
});

// ==========================================
// 2. SUBSCRIPTION MANAGEMENT
// ==========================================

// @desc    Cancel Subscription (Retention Flow)
// @route   POST /api/v1/profile/subscription/cancel
const cancelSubscription = asyncHandler(async (req, res) => {
    const { reason } = req.body; // Capture why they left
    const user = await User.findById(req.user.id);

    if (user.subscription.plan === 'null' || user.subscription.status === 'expired') {
        res.status(400); throw new Error('No active subscription to cancel.');
    }

    // Don't kill it immediately, just stop renewal
    user.subscription.autoRenew = false;
    // user.subscription.status = 'cancelled'; // Optional: Or keep 'active' until expiry
    
    // Log the reason (Optional: Save to a Feedback model)
    console.log(`User ${user.email} cancelled. Reason: ${reason}`);

    await user.save();

    // Send Confirmation Email
    // sendEmail(...)

    res.status(200).json({ 
        message: 'Subscription cancelled. Access remains until expiry date.',
        expiryDate: user.subscription.expiryDate
    });
});

// @desc    Step 1: Request OTP (Universal Intent Handler)
// @route   POST /api/v1/profile/otp/request
const requestSensitiveOTP = asyncHandler(async (req, res) => {
    // 1. Get Intent from Mobile App (e.g. "withdrawal", "wallet_update", "login")
    const { intent } = req.body; 
    
    const user = await User.findById(req.user.id);
    const otp = await generateOTP(user);

    // 2. Define Dynamic Variables based on Intent
    // Defaults (Generic)
    let subject = 'Security Verification - SetupRadar';
    let actionName = 'Account Action';
    let securityNote = 'If you did not request this code, please ignore this email.';

    // Tailoring based on Intent
    if (intent === 'withdrawal') {
        subject = 'Action Required: Verify Your Withdrawal';
        actionName = 'Withdrawal Request';
        securityNote = 'If you did not initiate this withdrawal, please log in and change your password immediately.';
    } else if (intent === 'wallet_update') {
        subject = 'Security Alert: Wallet Address Update';
        actionName = 'Wallet Address Change';
        securityNote = 'If you did not request to change your crypto wallet, contact support immediately.';
    }

    console.log(`📧 Sending OTP (${otp}) to ${user.email} | Intent: ${intent}`);

    // 3. Send Email
    await sendEmail({
        subject: subject,
        send_to: user.email,
        sent_from: "SetupRadar Security <no-reply@setupradar.app>",
        reply_to: "support@setupradar.app",
        templateKey: process.env.ZEPTO_TEMPLATE_OTP, 
        name: user.firstName,
        // 🛡️ MAPPING VARIABLES TO ZEPTO TEMPLATE
        extraParams: { 
            otp_code: otp,           
            action_name: actionName,
            security_note: securityNote,
            expiry_minutes: "10"     
        }
    });

    res.status(200).json({ message: `Security code sent to ${user.email}` });
});

// @desc    Step 2: Update Wallet Address (Requires OTP)
// @route   PUT /api/v1/profile/wallet
const updateWalletAddress = asyncHandler(async (req, res) => {
    const { address, network, otp } = req.body;

        // Allowed Networks
    const validNetworks = ['TRC20', 'ERC20', 'BEP20'];
    if (!validNetworks.includes(network)) {
        res.status(400); throw new Error(`Invalid network. Allowed: ${validNetworks.join(', ')}`);
    }
    const user = await User.findById(req.user.id).select('+sensitiveActionToken +sensitiveActionExpires');

    // 1. Verify OTP
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    if (
        user.sensitiveActionToken !== hashedOtp || 
        user.sensitiveActionExpires < Date.now()
    ) {
        res.status(401); throw new Error('Invalid or expired OTP');
    }

    // 2. Update Address
    user.cryptoWalletAddress = address;
    user.walletNetwork = network || 'TRC20';
    
    // 3. Clear OTP
    user.sensitiveActionToken = undefined;
    user.sensitiveActionExpires = undefined;
    await user.save();

    res.status(200).json({ 
        message: 'Wallet address updated successfully',
        wallet: { address, network }
    });
});


// @desc    Step 3: Request Withdrawal
// @route   POST /api/v1/profile/withdraw
const requestWithdrawal = asyncHandler(async (req, res) => {
    // 1. Input Validation: Assume 'amount' is in CENTS (e.g., 1500 = $15.00)
    const { amount, otp } = req.body;
    
    // Minimum Withdrawal: $100.00 (1000 cents)
    if (amount < 10000) { 
        res.status(400); throw new Error('Minimum withdrawal is $100.00');
    }

    const user = await User.findById(req.user.id).select('+sensitiveActionToken +sensitiveActionExpires');

    if (!user.cryptoWalletAddress) {
        res.status(400); throw new Error('Please connect a wallet address first');
    }

    // 2. OTP Verification
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    if (user.sensitiveActionToken !== hashedOtp || user.sensitiveActionExpires < Date.now()) {
        res.status(401); throw new Error('Invalid or expired OTP');
    }

    // ---------------------------------------------------------
    // 3. 🛡️ THE 5-DAY RULE CHECK (Fixed)
    // ---------------------------------------------------------
    // Logic: Calculate how much is LOCKED (Pending), then subtract from TOTAL.
    
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    // Find commissions that are TOO NEW (Pending)
    const pendingCommissions = await Transaction.find({ 
        user: user._id, 
        type: 'commission_credit',
        createdAt: { $gt: fiveDaysAgo } // Created AFTER 5 days ago (Newer)
    });

    const lockedAmount = pendingCommissions.reduce((sum, tx) => sum + tx.amount, 0);
    
    // Available = What you have - What is locked
    const availableBalance = user.walletBalance - lockedAmount;

    // Debug Log (Optional, remove in prod)
    console.log(`💰 Withdraw Check: Total=${user.walletBalance} | Locked=${lockedAmount} | Avail=${availableBalance}`);

    if (amount > availableBalance) {
        const availDollars = (availableBalance / 100).toFixed(2);
        res.status(400); 
        throw new Error(`Insufficient AVAILABLE balance. Available: $${availDollars} (Some funds are pending 5-day clearance).`);
    }

    // 4. Deduct & Record
    // Note: We use 'amount' directly because it is already in cents. 
    // Do NOT multiply by 100 again if frontend sends cents.
    user.walletBalance -= amount; 
    
    const tx = await Transaction.create({
        user: user._id,
        reference: `WD_${Date.now()}`,
        amount: amount, // Save as positive (type implies deduction) or negative depending on your preference
        currency: 'USD',
        type: 'withdrawal_request', // Distinct type for requests
        status: 'pending', // Waiting for Admin
        gateway: 'manual', 
        gatewayResponse: { 
            target_address: user.cryptoWalletAddress,
            network: user.walletNetwork
        }
    });

    // 5. Cleanup OTP
    user.sensitiveActionToken = undefined;
    user.sensitiveActionExpires = undefined;
    await user.save();

    res.status(200).json({ 
        success: true,
        message: 'Withdrawal request submitted successfully',
        transaction: tx
    });
});

// @desc    Get Referral & Withdrawal History
// @route   GET /api/v1/profile/financials
const getFinancialHistory = asyncHandler(async (req, res) => {
    const history = await Transaction.find({ 
        user: req.user.id,
        type: { $in: ['withdrawal', 'commission_credit'] }
    }).sort({ createdAt: -1 });

    res.status(200).json(history);
});

module.exports = {
    getProfile,
    updateAvatar,
    updateProfile,
    getWalletStats,
    deleteAccount,
    cancelSubscription,
    requestSensitiveOTP,
    updateWalletAddress,
    requestWithdrawal,
    getFinancialHistory,
};