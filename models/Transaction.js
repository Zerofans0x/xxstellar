
const mongoose = require('mongoose');

const baseOptions = { 
    discriminatorKey: 'type', 
    timestamps: true 
};

const TransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reference: { type: String, required: true, unique: true }, 
    orderId: { type: String },
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
    gateway: { type: String, enum: ['paystack', 'stripe', 'internal', 'manual', 'nomba', 'nowpayments', 'btcpay'], default: 'nowpayments' },
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