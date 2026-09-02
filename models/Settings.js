const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    singleton: { type: String, default: 'main_settings', unique: true },
    
    // Controls which gateway handles NEW incoming payments (Checkout)
incomingPaymentProvider: { 
        type: String, 
        // ADD btcpay and nowpayments to the enum
        enum: ['paystack', 'nomba', 'stripe', 'btcpay', 'nowpayments'], 
        default: 'paystack' 
    },

    // Controls which gateway handles OUTGOING transfers to creators
    payoutProvider: { 
        type: String, 
        enum: ['paystack', 'nomba'], 
        default: 'nomba' 
    },
    
    payoutType: { type: String, enum: ['manual', 'automatic'], default: 'manual' },

    // ✅ UPDATED: Added 'zeptomail' to the enum
    emailProvider: { 
        type: String, 
        enum: ['nodemailer', 'brevo', 'mailjet', 'zeptomail'], 
        default: 'zeptomail' 
    },
});

const Settings = mongoose.model('Settings', SettingsSchema);
module.exports = Settings;