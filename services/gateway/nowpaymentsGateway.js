const axios = require('axios');

// Sandbox: https://api.sandbox.nowpayments.io/v1 | Live: https://api.nowpayments.io/v1
const NOWPAYMENTS_BASE_URL = process.env.NOWPAYMENTS_API_URL || 'https://api.sandbox.nowpayments.io/v1'; 
const API_KEY = process.env.NOWPAYMENTS_API_KEY;

const getHeaders = () => {
    if (!API_KEY) throw new Error('Missing NOWPayments API Key.');
    return {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json'
    };
};

const initializeCryptoInvoice = async (email, amount, currency = 'USD', orderId, metadata = {}, callbackUrl) => {
    try {
        const payload = {
            price_amount: parseFloat(amount).toFixed(2),
            price_currency: currency.toLowerCase(),
            order_id: orderId,
            order_description: metadata.planSlug || 'Capital Top-Up',
            success_url: callbackUrl,
            cancel_url: callbackUrl,
            is_fee_paid_by_user: true
        };

        const response = await axios.post(`${NOWPAYMENTS_BASE_URL}/invoice`, payload, { headers: getHeaders() });
        
        // Standardize return object so the controller doesn't care which gateway is used
        return {
            id: response.data.id, 
            checkoutLink: response.data.invoice_url
        };
    } catch (error) {
        console.error('NOWPayments Init Error:', error.response?.data || error.message);
        throw error;
    }
};

const verifyCryptoInvoice = async (invoiceId) => {
    try {
        const response = await axios.get(`${NOWPAYMENTS_BASE_URL}/invoice/${invoiceId}`, { headers: getHeaders() });
        const status = response.data.payment_status; 
        
        // Map NOWPayments status to your system's standardized status
        let mappedStatus = 'Pending';
        if (['finished', 'paid', 'confirmed'].includes(status)) mappedStatus = 'Settled';
        else if (['partially_paid', 'waiting', 'confirming'].includes(status)) mappedStatus = 'Processing';
        else if (['expired', 'failed'].includes(status)) mappedStatus = 'Expired';

        return { status: mappedStatus, raw: response.data };
    } catch (error) {
        console.error('NOWPayments Verify Error:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = { initializeCryptoInvoice, verifyCryptoInvoice };