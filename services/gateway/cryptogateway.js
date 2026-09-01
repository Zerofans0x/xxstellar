const Settings = require('../models/Settings');
const btcpayGateway = require('./gateway/btcpayGateway');

const getProvider = async () => {
    const settings = await Settings.findOne({ singleton: 'main_settings' });
    return settings ? settings.incomingPaymentProvider : 'btcpay'; 
};

// Initialize Subscription or Capital Increase via Crypto
const initializePayment = async (user, amount, currency = 'USD', orderId, metadata = {}, callbackUrl) => {
    const provider = await getProvider();
    
    const enrichedMetadata = {
        ...metadata,
        userId: user._id.toString(),
        provider: provider
    };

    if (provider === 'btcpay') {
        return await btcpayGateway.initializeCryptoInvoice(
            user.email,
            amount,
            currency,
            orderId,
            enrichedMetadata,
            callbackUrl
        );
    } 
    
    throw new Error(`Provider ${provider} not supported for crypto payments.`);
};

// Verify Crypto Payment Status
const verifyPayment = async (invoiceId) => {
    const provider = await getProvider();

    if (provider === 'btcpay') {
        return await btcpayGateway.verifyCryptoInvoice(invoiceId);
    }
    
    throw new Error(`Provider ${provider} verification not supported.`);
};

module.exports = {
    initializePayment,
    verifyPayment
};