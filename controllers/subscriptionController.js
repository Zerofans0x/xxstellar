// File: controllers/subscriptionController.js
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { Transaction, Commission } = require('../models/Transaction');
const paymentService = require('../services/paymentService');
const PLANS = require('../config/plans');
const PsycheProfile = require('../models/PsycheProfile');
const { sendEmail } = require('../services/emailService');

const subscribeToPlanCrypto = asyncHandler(async (req, res) => {
    const { slug, customAmount } = req.body;
    const user = await User.findById(req.user.id);

    let targetAmount = 0;
    let planSlug = 'custom';
    let planName = 'Custom Capital Top-Up';

    if (slug) {
        const plan = Object.values(PLANS).find(p => p.slug === slug);
        if (!plan) { res.status(400); throw new Error('Invalid plan selected.'); }
        if (plan.slug === 'free') { res.status(400); throw new Error('You cannot pay for the Free plan.'); }
        
        targetAmount = plan.pricing?.ROW?.amount || 0;
        planSlug = plan.slug;
        planName = plan.name;
    } else if (customAmount) {
        targetAmount = parseFloat(customAmount);
        if (isNaN(targetAmount) || targetAmount <= 0) {
            res.status(400);
            throw new Error('Invalid custom investment amount.');
        }
    } else {
        res.status(400);
        throw new Error('Either a plan slug or a custom amount must be provided.');
    }

    const orderId = `INV-${Date.now()}-${user._id.toString().slice(-6)}`;
    let frontendCallback = `${process.env.SETUPRADAR_FRONTEND_URL}/subscription-success?orderId=${orderId}`;
    if (!frontendCallback.startsWith('http')) frontendCallback = `https://${frontendCallback}`;

    try {
        const invoice = await paymentService.initializePayment(
            user,
            targetAmount,
            'USD',
            orderId,
            { planSlug },
            frontendCallback
        );

        await Transaction.create({
            user: user._id,
            reference: invoice.id,
            amount: targetAmount * 100,
            currency: 'USD',
            status: 'pending',
            type: slug ? 'subscription' : 'top_up',
            planType: planSlug,
            gateway: 'btcpay',
        });

        sendEmail({
            subject: `Complete your ${planName} Payment 🚀`, 
            send_to: user.email,
            sent_from: "SetupRadar <hello@setupradar.app>",
            reply_to: "support@setupradar.app",
            templateKey: process.env.ZEPTO_TEMPLATE_CHECKOUT_INTENT,
            extraParams: { 
                name: user.firstName, 
                plan_name: planName,
                action_url: invoice.checkoutLink 
            }
        }).catch(err => console.error("Checkout Intent Email fail:", err));

        res.status(200).json({
            success: true,
            checkoutUrl: invoice.checkoutLink,
            invoiceId: invoice.id,
            orderId: orderId,
            amount: targetAmount
        });

    } catch (error) {
        console.error("Crypto Payment Init Error:", error);
        res.status(500); throw new Error('Could not initiate crypto payment gateway.');
    }
});

const verifySubscriptionCrypto = asyncHandler(async (req, res) => {
    const { invoiceId } = req.body;
    if (!invoiceId) { res.status(400); throw new Error('No invoice ID provided.'); }

    const transaction = await Transaction.findOne({ reference: invoiceId });
    if (!transaction) { res.status(404); throw new Error('Transaction record not found.'); }
    if (transaction.status === 'success') {
        return res.status(200).json({ success: true, message: 'Already processed.' });
    }

    const invoiceData = await paymentService.verifyPayment(invoiceId);
    
    if (invoiceData && (invoiceData.status === 'Settled' || invoiceData.status === 'Processing')) {
        transaction.status = 'success';
        await transaction.save();

        const user = await User.findById(transaction.user);

        if (transaction.type === 'subscription') {
            const planConfig = Object.values(PLANS).find(p => p.slug === transaction.planType);

            if (user.referredBy && planConfig && planConfig.slug !== 'free') {
                const baseUsdPrice = transaction.amount / 100; 
                const commissionInCents = Math.floor((baseUsdPrice * 100) * 0.20);
                
                const referrer = await User.findById(user.referredBy);
                if (referrer && commissionInCents > 0) {
                    referrer.walletBalance += commissionInCents; 
                    await referrer.save();

                    await Commission.create({
                        user: referrer._id,
                        reference: `REF_COM_${user._id}_${Date.now()}`,
                        amount: commissionInCents,
                        currency: 'USD', 
                        status: 'pending',
                        gateway: 'internal'
                    });
                    
                    const io = req.app.get('socketio');
                    if (io) io.to(referrer._id.toString()).emit('wallet_update', { amount: commissionInCents });
                }
            }

            const now = new Date();
            const expiry = new Date();
            expiry.setDate(now.getDate() + planConfig.duration);

            user.subscription.plan = planConfig.slug;
            user.subscription.status = 'active';
            user.subscription.startDate = now;
            user.subscription.expiryDate = expiry;
            user.subscription.isTrialActive = false;
            user.subscription.autoRenew = false;
            await user.save();

            // --- PSYCHE PROFILE SYNC ---
            const psycheProfile = await PsycheProfile.findOne({ user: user._id });
            if (psycheProfile) {
                let baseTier = planConfig.slug.split('_')[0]; // e.g., 'basic', 'pro', 'ultra'
                let formattedTier = baseTier.charAt(0).toUpperCase() + baseTier.slice(1);
                
                // Map to allowed enum values if needed ('Basic', 'Pro', 'Ultra')
                const validTiers = ['Basic', 'Pro', 'Ultra'];
                if (validTiers.includes(formattedTier)) {
                    psycheProfile.planTier = formattedTier;
                    await psycheProfile.save();
                }
            }
        } else if (transaction.type === 'top_up') {
            const topUpAmountCents = transaction.amount;
            user.walletBalance = (user.walletBalance || 0) + topUpAmountCents;
            await user.save();
        }

        res.status(200).json({ success: true, message: 'Crypto payment verified and account updated successfully!' });
    } else {
        transaction.status = invoiceData.status === 'Expired' ? 'expired' : 'pending';
        await transaction.save();
        res.status(400).json({ success: false, message: `Payment status is: ${invoiceData.status}` });
    }
});

module.exports = { subscribeToPlanCrypto, verifySubscriptionCrypto };