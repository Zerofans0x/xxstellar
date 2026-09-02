
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { Transaction, Commission } = require('../models/Transaction');
const paymentService = require('../services/paymentService');
const PLANS = require('../config/plans');
const InvestorProfile = require('../models/InvestorProfile');
const { sendEmail } = require('../services/emailService');


const subscribeToPlanCrypto = asyncHandler(async (req, res) => {
    const { slug, customAmount, gateway } = req.body;
    const user = await User.findById(req.user.id);

    let targetAmount = 0;
    let planSlug = 'custom';
    let planName = 'Custom Capital Top-Up';

    if (slug) {
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
    } else if (customAmount) {
        targetAmount = Number(customAmount);
    }

    if (targetAmount <= 0) {
        res.status(400);
        throw new Error('Invalid payment amount specified.');
    }

    const orderId = `INV-${Date.now()}-${user._id.toString().slice(-6)}`;
    let frontendCallback = `${process.env.STELLARTERM_FRONTEND_URL}/subscription-success?orderId=${orderId}`;
    if (!frontendCallback.startsWith('http')) frontendCallback = `https://${frontendCallback}`;

    try {
        const { invoice, providerName } = await paymentService.initializePayment(
            user,
            targetAmount,
            'USD',
            orderId,
            { planSlug },
            frontendCallback,
            gateway 
        );

        await Transaction.create({
            user: user._id,
            reference: invoice.id,
            orderId: orderId,
            amount: targetAmount, 
            currency: 'USD',
            status: 'pending',
            type: slug ? 'subscription' : 'top_up',
            planType: planSlug,
            gateway: providerName,
        });

        sendEmail({
            subject: `Complete your ${planName} Payment 🚀`, 
            send_to: user.email,
            sent_from: "StellarTerm <hello@mystellarterm.com>",
            reply_to: "support@mystellarterm.com",
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
            amount: targetAmount,
            gatewayUsed: providerName
        });
        
    } catch (error) {
        console.error("Crypto Payment Init Error:", error);
        res.status(500); 
        throw new Error('Could not initiate crypto payment gateway.');
    }
});

const verifySubscriptionCrypto = asyncHandler(async (req, res) => {
    const { invoiceId } = req.body;
    if (!invoiceId) { 
        res.status(400); 
        throw new Error('No invoice ID or order ID provided.'); 
    }

    // 1. Flexible Lookup: Find by gateway reference OR system orderId
    const transaction = await Transaction.findOne({
        $or: [{ reference: invoiceId }, { orderId: invoiceId }]
    });

    if (!transaction) { 
        res.status(404); 
        throw new Error('Transaction record not found.'); 
    }

    if (transaction.status === 'success') {
        return res.status(200).json({ success: true, message: 'Already processed.' });
    }

    // 2. Pass exact gateway reference and gateway name to the payment service
    const invoiceData = await paymentService.verifyPayment(
        transaction.reference, 
        transaction.gateway
    );
    
    if (invoiceData && (invoiceData.status === 'Settled' || invoiceData.status === 'Processing')) {
        transaction.status = 'success';
        await transaction.save();

        const user = await User.findById(transaction.user);

        if (transaction.type === 'subscription') {
            const planConfig = Object.values(PLANS).find(p => p.slug === transaction.planType);

            if (planConfig) {
                // Handle Referral Commission
                if (user.referredBy) {
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
                            status: 'success', // Marked success as wallet balance was credited
                            gateway: 'internal'
                        });
                        
                        const io = req.app.get('socketio');
                        if (io) io.to(referrer._id.toString()).emit('wallet_update', { amount: commissionInCents });
                    }
                }

                const now = new Date();
                const expiry = new Date();
                const durationDays = planConfig.duration === Infinity ? 36500 : (planConfig.duration || 365);
                expiry.setDate(now.getDate() + durationDays);

                // 3. Update User model & mark onboarding complete
                user.tier.level = planConfig.slug;
                user.tier.status = 'active';
                user.tier.startDate = now;
                user.tier.expiryDate = planConfig.duration === Infinity ? null : expiry;
                user.tier.autoRenew = false;
                user.isOnboarded = true; // Marks onboarding complete
                await user.save();

                // 4. Sync InvestorProfile using slug enum ('growth-tier')
                const investorProfile = await InvestorProfile.findOne({ user: user._id });
                if (investorProfile) {
                    investorProfile.planTier = planConfig.slug; // Matches enum ['starter-tier', 'growth-tier', ...]
                    await investorProfile.save(); // Triggers pre-save hook for limits sync
                }
            }
        } else if (transaction.type === 'top_up') {
            const topUpAmountCents = transaction.amount;
            user.walletBalance = (user.walletBalance || 0) + topUpAmountCents;
            await user.save();
        }

        res.status(200).json({ 
            success: true, 
            message: 'Crypto payment verified and account updated successfully!' 
        });
    } else {
        transaction.status = invoiceData.status === 'Expired' ? 'expired' : 'pending';
        await transaction.save();
        res.status(400).json({ 
            success: false, 
            message: `Payment status is: ${invoiceData.status}` 
        });
    }
});

module.exports = { subscribeToPlanCrypto, verifySubscriptionCrypto };  