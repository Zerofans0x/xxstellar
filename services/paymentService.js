

const Settings = require('../models/Settings');
const btcpayGateway = require('./gateway/btcpayGateway');
const nowpaymentsGateway = require('./gateway/nowpaymentsGateway');
const paystackGateway = require('./gateway/paystackGateway'); 
// 1. Gateway Registry - Adding a new gateway in the future is just adding one line here.
const gateways = {
    'btcpay': btcpayGateway,
    'nowpayments': nowpaymentsGateway,
    'paystack': paystackGateway
};

// 2. Dynamic Provider Resolution
const getActiveProvider = async (requestedProvider) => {
    const settings = await Settings.findOne({ singleton: 'main_settings' });
    const defaultProvider = settings?.incomingPaymentProvider || 'nowpayments'; // Fallback to paystack if settings are missing
    
    // If frontend requests a specific gateway (multi-option UI) and we support it, use it. Otherwise fallback to admin default.
    if (requestedProvider && gateways[requestedProvider]) {
        return requestedProvider;
    }
    return defaultProvider;
};

// 3. Dynamic Initialization
const initializePayment = async (user, amount, currency = 'USD', orderId, metadata = {}, callbackUrl, requestedProvider) => {
    const providerName = await getActiveProvider(requestedProvider);
    const gateway = gateways[providerName];

    if (!gateway) throw new Error(`Gateway ${providerName} is not implemented.`);

    const enrichedMetadata = { ...metadata, userId: user._id.toString(), provider: providerName };
    
    const invoice = await gateway.initializeCryptoInvoice(user.email, amount, currency, orderId, enrichedMetadata, callbackUrl);
    
    // Return both the invoice AND the resolved provider so the controller can log it
    return { invoice, providerName }; 
};

// 4. Dynamic Verification
const verifyPayment = async (invoiceId, providerName) => {
    const gateway = gateways[providerName];
    if (!gateway) throw new Error(`Gateway ${providerName} is not implemented.`);
    
    return await gateway.verifyCryptoInvoice(invoiceId);
};

module.exports = { initializePayment, verifyPayment };