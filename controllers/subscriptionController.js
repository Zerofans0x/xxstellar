
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { Transaction, Commission } = require('../models/Transaction');
const paymentService = require('../services/paymentService');
const PLANS = require('../config/plans');
const InvestorProfile = require('../models/InvestorProfile');
const { sendEmail } = require('../services/emailService');

const subscribeToPlanCrypto = asyncHandler(async (req, res) => {
    const { slug, customAmount } = req.body;
    const user = await User.findById(req.user.id);

    let targetAmount = 0;
    let planSlug = 'custom';
    let planName = 'Custom Capital Top-Up';

    if (slug) {
        // Find plan by matching slug case-insensitively or matching uppercase object keys
        const requestedSlug = slug.trim().toLowerCase();
        const plan = Object.entries(PLANS).find(([key, p]) => 
            key.toLowerCase() === requestedSlug || p.slug.toLowerCase() === requestedSlug
        )?.[1];

        if (!plan) { 
            res.status(400); 
            throw new Error(`Invalid plan selected: ${slug}`); 
        }
        
        targetAmount = plan.price || 0;
        planSlug = plan.slug;
        planName = plan.name;
    }

    const orderId = `INV-${Date.now()}-${user._id.toString().slice(-6)}`;
    let frontendCallback = `${process.env.STELLARTERM_FRONTEND_URL}/subscription-success?orderId=${orderId}`;
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
            amount: targetAmount, // Stored directly in cents or standard denomination
            currency: 'USD',
            status: 'pending',
            type: slug ? 'subscription' : 'top_up',
            planType: planSlug,
            gateway: 'btcpay',
        });

        sendEmail({
            subject: `Complete your ${planName} Payment 🚀`, 
            send_to: user.email,
            sent_from: "StellarTerm <hello@stellarterm.com>",
            reply_to: "support@stellarterm.com",
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

            if (user.referredBy && planConfig) {
                const baseUsdPrice = transaction.amount; 
                const commissionInCents = Math.floor(baseUsdPrice * 0.20);
                
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
            expiry.setDate(now.getDate() + (planConfig.duration === Infinity ? 36500 : planConfig.duration));

            // Update User model fields safely
            user.tier.level = planConfig.slug;
            user.tier.status = 'active';
            user.tier.startDate = now;
            user.tier.expiryDate = planConfig.duration === Infinity ? null : expiry;
            user.tier.autoRenew = false;
            await user.save();

            // --- INVESTOR PROFILE SYNC ---
            const investorProfile = await InvestorProfile.findOne({ user: user._id });
            if (investorProfile) {
                investorProfile.planTier = planConfig.name; // Matches enum ['Starter Tier', 'Growth Tier', 'Executive Tier', 'Institutional']
                await investorProfile.save(); // Triggers pre-save hook for limits sync
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

module.exports = { subscribeToPlanCrypto, verifySubscriptionCrypto };  is tis correct now?