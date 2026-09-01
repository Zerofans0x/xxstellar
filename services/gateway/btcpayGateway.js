// File: services/gateway/btcpayGateway.js
const axios = require('axios');

const BTCPAY_BASE_URL = process.env.BTCPAY_SERVER_URL; 
const STORE_ID = process.env.BTCPAY_STORE_ID;

const getHeaders = () => {
    const apiKey = process.env.BTCPAY_API_KEY;
    if (!apiKey) {
        throw new Error('Missing BTCPay Server API Key.');
    }
    return {
        'Authorization': `token ${apiKey}`,
        'Content-Type': 'application/json'
    };
};

const initializeCryptoInvoice = async (email, amount, currency = 'USD', orderId, metadata = {}, callbackUrl) => {
    try {
        const payload = {
            amount: parseFloat(amount).toFixed(2),
            currency: currency,
            metadata: {
                ...metadata,
                buyerEmail: email,
                orderId: orderId
            },
            checkout: {
                speedPolicy: 'HighSpeed',
                expirationMinutes: 15,
                redirectURL: callbackUrl
            }
        };

        const response = await axios.post(
            `${BTCPAY_BASE_URL}/api/v1/stores/${STORE_ID}/invoices`,
            payload,
            { headers: getHeaders() }
        );

        return response.data;
    } catch (error) {
        console.error('BTCPay Invoice Init Error:', error.response?.data || error.message);
        throw error;
    }
};

const verifyCryptoInvoice = async (invoiceId) => {
    try {
        const response = await axios.get(
            `${BTCPAY_BASE_URL}/api/v1/invoices/${invoiceId}`,
            { headers: getHeaders() }
        );
        return response.data;
    } catch (error) {
        console.error('BTCPay Verify Error:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = {
    initializeCryptoInvoice,
    verifyCryptoInvoice
};