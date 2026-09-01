
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    // --- IDENTITY ---
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: false, select: false },
    authMethod: { type: String, enum: ['local', 'google'], default: 'local' },
    
    firstName: { type: String, required: true },
    lastName: { type: String, required: false, default: '' },
    userName: { type: String, unique: true, sparse: true }, 
    avatarUrl: { type: String },

    // --- SECURITY & ROLES ---
    role: { type: String, enum: ['investor', 'institutional', 'admin', 'superadmin'], default: 'investor' },
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    
    // --- SOCIAL IDS ---
    googleId: { type: String, unique: true, sparse: true },

    // --- CAPITAL OPERATIONS & REFERRALS ---
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    payoutBankName: { type: String, trim: true },
    payoutAccountNumber: { type: String, trim: true },
    payoutAccountName: { type: String, trim: true },
    paystackRecipientCode: { type: String, trim: true },
    referralCode: { type: String, unique: true, sparse: true }, 
    walletBalance: { type: Number, default: 0 }, 
    cryptoWalletAddress: { type: String, trim: true },
    walletNetwork: { type: String, default: 'TRC20' },

    // --- STATUS ---
    isEmailVerified: { type: Boolean, default: false },
    isOnboarded: { type: Boolean, default: false },
    lastLogin: { type: Date },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    deletionReason: { type: String },

  
    // --- RISK/TIER CLASSIFICATION ---
    tier: {
        // Unified the enums to strictly match your system slugs
        level: { type: String, enum: ['starter-tier', 'growth-tier', 'executive-tier', 'institutional', 'null'], default: 'null' },
        status: { type: String, enum: ['active', 'expired', 'cancelled', 'inactive', 'pending'], default: 'inactive' },
        startDate: { type: Date },
        expiryDate: { type: Date },
        autoRenew: { type: Boolean, default: false }
    },

    // --- FRONTEND HELPERS ---
    postAuthPath: { type: String }, 

    // --- OTP TOKENS (Standardized) ---
    emailVerificationToken: { type: String, select: false }, // Hashed OTP
    emailVerificationTokenExpires: { type: Date, select: false },
    resetPasswordToken: { type: String, select: false }, // Hashed OTP
    resetPasswordExpires: { type: Date, select: false },

}, { timestamps: true });

// --- METHODS ---
UserSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.passwordHash) return false;
    return await bcrypt.compare(enteredPassword, this.passwordHash);
};

UserSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

const User = mongoose.model('User', UserSchema);
module.exports = User;