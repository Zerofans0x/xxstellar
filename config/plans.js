// config/plans.js

const SUBSCRIPTION_PLANS = {
    STANDARD: {
        name: 'Standard',
        slug: 'standard',
        price: 0,
        currency: 'USD',
        billingCycle: 'Forever',
        duration: Infinity,
        features: {
            maxMandates: 1,
            maxCapitalAllocation: 10000,
            hasIntroTelemetry: true,
            hasPlatformBasics: true,
            hasAdvancedMandates: false,
            hasRiskFramework: false,
            hasExecutionJournal: false,
            hasStrategyAlerts: false
        }
    },
    PREMIUM: {
        name: 'Premium',
        slug: 'premium',
        type: 'yearly',
        price: 24900, // Storing in cents ($249.00)
        currency: 'USD',
        billingCycle: 'Yearly',
        duration: 365,
        features: {
            maxMandates: 5,
            maxCapitalAllocation: 100000,
            hasIntroTelemetry: true,
            hasPlatformBasics: true,
            hasAdvancedMandates: true,       // All institutional mandates
            hasRiskFramework: true,       // Complete risk telemetry framework
            hasExecutionJournal: false,   // X in terminal view
            hasStrategyAlerts: false      // X in terminal view
        }
    },
    INSTITUTIONAL: {
        name: 'Institutional',
        slug: 'institutional',
        type: 'yearly',
        price: 34900, // $349.00
        currency: 'USD',
        billingCycle: 'Yearly',
        duration: 365,
        features: {
            maxMandates: 999,
            maxCapitalAllocation: 999999999,
            hasIntroTelemetry: true,
            hasPlatformBasics: true,
            hasAdvancedMandates: true,
            hasRiskFramework: true,
            hasExecutionJournal: true,    // Included in Institutional
            hasStrategyAlerts: true       // Strategy alerts & automated monitors included
        }
    }
};

module.exports = SUBSCRIPTION_PLANS;