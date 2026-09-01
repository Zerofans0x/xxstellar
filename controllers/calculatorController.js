const asyncHandler = require('express-async-handler');

// @desc    Calculate Risk-to-Reward, Win Rate, and Expected Value
// @route   POST /api/v1/psyche/calculator/risk-reward
// @access  Private
const calculateRiskReward = asyncHandler(async (req, res) => {
    const { pair, entryPrice, stopLoss, takeProfit, riskAmount, direction } = req.body;

    if (!entryPrice || !stopLoss || !takeProfit || !riskAmount || !direction) {
        res.status(400);
        throw new Error("Please provide all required calculation parameters");
    }

    // Convert values to floats
    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    const risk = parseFloat(riskAmount);

    // Calculate distance in pips/units (Simplified forex pip logic example)
    const stopLossDistance = Math.abs(entry - sl);
    const takeProfitDistance = Math.abs(tp - entry);

    // Calculate R:R Ratio (e.g., 1:2.00)
    const rrRatio = stopLossDistance === 0 ? 0 : (takeProfitDistance / stopLossDistance).toFixed(2);

    // Calculate break-even win rate percentage: Risk / (Risk + Reward) * 100
    const minWinRate = ((1 / (1 + parseFloat(rrRatio))) * 100).toFixed(0);

    // Calculate Expected Value (EV) and Reward at Target
    const rewardAmount = risk * parseFloat(rrRatio);
    const expectedValue = (rewardAmount * (minWinRate / 100)) - (risk * (1 - (minWinRate / 100))); // Basic EV model

    res.status(200).json({
        success: true,
        data: {
            pair: pair || "EURUSD",
            riskRewardRatio: `1:${rrRatio}`,
            expectedValue: `+$${rewardAmount.toFixed(0)}`, // Or calculate net EV
            metrics: {
                stopLossPips: (stopLossDistance * 10000).toFixed(0), // Standard forex pip conversion factor
                takeProfitPips: (takeProfitDistance * 10000).toFixed(0),
                minWinRate: `${minWinRate}%`,
                rewardAtTarget: `+$${rewardAmount.toFixed(0)}`
            }
        }
    });
});

// @desc    Calculate exact position size (Lots) based on account risk (Dynamic Feed)
// @route   POST /api/v1/psyche/calculator/position-size
// @access  Private
const calculatePositionSize = asyncHandler(async (req, res) => {
    const { accountSize, riskPercentage, stopLossPips, pair } = req.body;

    if (!accountSize || !riskPercentage || !stopLossPips || !pair) {
        res.status(400);
        throw new Error("Please provide account size, risk percentage, stop loss pips, and pair");
    }

    const balance = parseFloat(accountSize);
    const riskPct = parseFloat(riskPercentage);
    const pips = parseFloat(stopLossPips);
    const formattedPair = pair.toUpperCase();

    // 1. Calculate Dollar Amount at Risk
    const amountAtRisk = balance * (riskPct / 100);

    // 2. Determine Asset Class & Base Pip Value
    let pipValueInQuoteCurrency = 10; // Standard FX is 10 units of the quote currency per pip
    let quoteCurrency = formattedPair.substring(3, 6); // e.g., 'USD' from 'EURUSD', 'JPY' from 'GBPJPY'
    let isIndexOrCommodity = false;

    // Handle JPY Crosses (Pip decimal is 0.01 instead of 0.0001)
    if (formattedPair.includes('JPY')) {
        pipValueInQuoteCurrency = 1000; // 1 standard lot = 1000 JPY per pip
        quoteCurrency = 'JPY';
    } 
    // Handle Gold (XAUUSD)
    else if (formattedPair === 'XAUUSD') {
        // Standard Gold: 1 lot = 100 oz. A $1.00 move = 10 pips. 
        // Therefore, 1 pip = $10.
        pipValueInQuoteCurrency = 10; 
        quoteCurrency = 'USD';
        isIndexOrCommodity = true;
    }
    // Handle Indices (NAS100, US30)
    else if (['NAS100', 'US30', 'SPX500'].includes(formattedPair)) {
        // Most CFDs assume 1 lot = $1 per point (pip). 
        pipValueInQuoteCurrency = 1; 
        quoteCurrency = 'USD';
        isIndexOrCommodity = true;
    }

    // 3. Fetch Live Exchange Rate if Quote Currency is NOT USD
    let conversionRateToUSD = 1;

    if (quoteCurrency !== 'USD' && !isIndexOrCommodity) {
        try {
            // Using Frankfurter API (Free, no key required, highly reliable for Fiat)
            const response = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${quoteCurrency}`);
            const data = await response.json();
            
            if (data && data.rates && data.rates[quoteCurrency]) {
                conversionRateToUSD = data.rates[quoteCurrency];
            } else {
                throw new Error("Rate not found");
            }
        } catch (error) {
            console.error(`Failed to fetch live rate for USD${quoteCurrency}:`, error);
            res.status(503);
            throw new Error(`Market data feed unavailable for ${quoteCurrency}. Please try again.`);
        }
    }

    // 4. Calculate Final Pip Value in USD
    // If quote is USD, it divides by 1. If quote is JPY, it divides 1000 by the live USDJPY rate (e.g., 150.50).
    const pipValueInUSD = pipValueInQuoteCurrency / conversionRateToUSD;

    // 5. Calculate Exact Lot Size
    const standardLots = amountAtRisk / (pips * pipValueInUSD);

    res.status(200).json({
        success: true,
        data: {
            pair: formattedPair,
            recommendedPositionSize: `${standardLots.toFixed(2)} lots`,
            equivalentUnits: `Equivalent to ${(standardLots * 100000).toLocaleString()} units`,
            details: {
                amountAtRisk: `$${amountAtRisk.toFixed(2)}`,
                stopLossPips: pips,
                livePipValueUSD: `$${pipValueInUSD.toFixed(4)}`
            }
        }
    });
});

module.exports = {
    calculateRiskReward,
    calculatePositionSize
};