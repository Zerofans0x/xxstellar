// // File: models/Transaction.js
// const mongoose = require('mongoose');

// // 1. The Base Schema 
// const baseOptions = { 
//     discriminatorKey: 'type', 
//     timestamps: true 
// };

// const TransactionSchema = new mongoose.Schema({
//     user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     reference: { type: String, required: true, unique: true }, 
//     amount: { type: Number, required: true },
//     currency: { type: String, default: 'NGN' },
//     status: { 
//         type: String, 
//         enum: ['pending', 'success', 'failed', 'abandoned', 'expired'], 
//         default: 'pending' 
//     }
// }, baseOptions);

// const Transaction = mongoose.model('Transaction', TransactionSchema);

// // ----------------------------------------------------------------
// // 2. The Discriminators (Sub-Models)
// // ----------------------------------------------------------------

// // A. Subscriptions (Inbound Money)
// const SubscriptionTransaction = Transaction.discriminator('subscription', new mongoose.Schema({
//     planType: { 
//         type: String, 
//         enum: [
//             'free', 'starter', 'premium', 'elite', 
//             'starter_yearly', 'premium_yearly', 'elite_yearly', 'null', 'custom'
//         ],
//         required: true 
//     },
//     // Added 'btcpay' to the gateway enum list
//     gateway: { type: String, enum: ['paystack', 'stripe', 'internal', 'manual', 'nomba', 'btcpay'], default: 'paystack' },
//     gatewayResponse: { type: Object }
// }));

// // B. Commissions (Referral Earnings)
// const Commission = Transaction.discriminator('commission_credit', new mongoose.Schema({
//     gateway: { type: String, default: 'internal' },
//     gatewayResponse: { type: Object } 
// }));

// // C. Payout Requests (Outbound Money)
// const PayoutRequest = Transaction.discriminator('withdrawal_request', new mongoose.Schema({
//     gateway: { type: String, default: 'manual' },
//     gatewayResponse: { 
//         type: Object 
//     }
// }));

// module.exports = {
//     Transaction,
//     SubscriptionTransaction,
//     Commission,
//     PayoutRequest
// };


// File: models/Transaction.js
const mongoose = require('mongoose');

const baseOptions = { 
    discriminatorKey: 'type', 
    timestamps: true 
};

const TransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reference: { type: String, required: true, unique: true }, 
    amount: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: { 
        type: String, 
        enum: ['pending', 'success', 'failed', 'abandoned', 'expired'], 
        default: 'pending' 
    }
}, baseOptions);

const Transaction = mongoose.model('Transaction', TransactionSchema);

const SubscriptionTransaction = Transaction.discriminator('subscription', new mongoose.Schema({
    planType: { 
        type: String, 
        enum: [
            'free', 'null', 'custom',
            'starter-tier', 'growth-tier', 'executive-tier', 'institutional',
            // Legacy fallbacks just in case
            'starter', 'premium', 'elite', 'starter_yearly', 'premium_yearly', 'elite_yearly'
        ],
        required: true 
    },
    gateway: { type: String, enum: ['paystack', 'stripe', 'internal', 'manual', 'nomba', 'btcpay'], default: 'paystack' },
    gatewayResponse: { type: Object }
}));

const Commission = Transaction.discriminator('commission_credit', new mongoose.Schema({
    gateway: { type: String, default: 'internal' },
    gatewayResponse: { type: Object } 
}));

const PayoutRequest = Transaction.discriminator('withdrawal_request', new mongoose.Schema({
    gateway: { type: String, default: 'manual' },
    gatewayResponse: { type: Object } 
}));

module.exports = {
    Transaction,
    SubscriptionTransaction,
    Commission,
    PayoutRequest
};