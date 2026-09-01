
const SUBSCRIPTION_PLANS = {
    'STARTER_TIER': {
        name: 'Starter Tier',
        slug: 'starter-tier',
        price: 3000,
        currency: 'USD',
        billingCycle: 'Forever',
        duration: Infinity,
        features: {
            maxMandates: 1,
            maxCapitalAllocation: 3000,
            hasIntroTelemetry: true,
            hasPlatformBasics: true,
            hasAdvancedMandates: false,
            hasRiskFramework: false,
            hasExecutionJournal: false,
            hasStrategyAlerts: false
        }
    },
    'GROWTH_TIER': {
        name: 'Growth Tier',
        slug: 'growth-tier',
        price: 5000,
        currency: 'USD',
        billingCycle: 'Forever',
        duration: Infinity,
        features: {
            maxMandates: 3,
            maxCapitalAllocation: 5000,
            hasIntroTelemetry: true,
            hasPlatformBasics: true,
            hasAdvancedMandates: true,
            hasRiskFramework: true,
            hasExecutionJournal: false,
            hasStrategyAlerts: false
        }
    },
    'EXECUTIVE_TIER': {
        name: 'Executive Tier',
        slug: 'executive-tier',
        price: 25000,
        currency: 'USD',
        billingCycle: 'Yearly',
        duration: 365,
        features: {
            maxMandates: 10,
            maxCapitalAllocation: 25000,
            hasIntroTelemetry: true,
            hasPlatformBasics: true,
            hasAdvancedMandates: true,
            hasRiskFramework: true,
            hasExecutionJournal: true,
            hasStrategyAlerts: false
        }
    },
    'INSTITUTIONAL': {
        name: 'Institutional',
        slug: 'institutional',
        price: 100000,
        currency: 'USD',
        billingCycle: 'Yearly',
        duration: 365,
        features: {
            maxMandates: 999,
            maxCapitalAllocation: 100000,
            hasIntroTelemetry: true,
            hasPlatformBasics: true,
            hasAdvancedMandates: true,
            hasRiskFramework: true,
            hasExecutionJournal: true,
            hasStrategyAlerts: true
        }
    }
};

module.exports = SUBSCRIPTION_PLANS;