const axios = require('axios');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

// Dynamic header resolution supporting single key or currency-specific keys
const getHeaders = (currency = 'USD') => {
    const secretKey =
        process.env.PAYSTACK_SECRET_KEY ||
        (currency === 'NGN' ? process.env.PAYSTACK_SECRET_KEY_NGN : process.env.PAYSTACK_SECRET_KEY_USD);

    if (!secretKey) {
        throw new Error(`Missing Paystack Secret Key for currency: ${currency}`);
    }

    return {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
    };
};

/**
 * Standardized Payment Initialization
 * Matches BTCPay & NOWPayments interface
 */
const initializeCryptoInvoice = async (email, amount, currency = 'USD', orderId, metadata = {}, callbackUrl) => {
    try {
        // Paystack requires amounts in cents/kobo (Multiply dollars by 100)
        const amountInSubunits = Math.round(parseFloat(amount) * 100);

        const payload = {
            email,
            amount: amountInSubunits,
            currency: currency.toUpperCase(),
            reference: orderId, // Pass system orderId as Paystack reference
            callback_url: callbackUrl,
            metadata: JSON.stringify(metadata)
        };

        const response = await axios.post(
            `${PAYSTACK_BASE_URL}/transaction/initialize`,
            payload,
            { headers: getHeaders(currency) }
        );

        // Standardized return shape expected by paymentService
        return {
            id: response.data.data.reference,
            checkoutLink: response.data.data.authorization_url
        };
    } catch (error) {
        console.error('Paystack Init Error:', error.response?.data || error.message);
        throw error;
    }
};

/**
 * Standardized Payment Verification
 * Matches BTCPay & NOWPayments interface
 */
const verifyCryptoInvoice = async (reference) => {
    try {
        const response = await axios.get(
            `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
            { headers: getHeaders() }
        );

        const rawStatus = response.data.data.status;

        // Map Paystack native status to system standardized status
        let mappedStatus = 'Pending';
        if (rawStatus === 'success') mappedStatus = 'Settled';
        else if (['failed', 'abandoned'].includes(rawStatus)) mappedStatus = 'Expired';
        else if (rawStatus === 'ongoing') mappedStatus = 'Processing';

        return {
            status: mappedStatus,
            raw: response.data.data
        };
    } catch (error) {
        console.error('Paystack Verify Error:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = {
    initializeCryptoInvoice,
    verifyCryptoInvoice
};