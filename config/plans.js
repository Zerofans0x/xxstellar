// // // config/plans.js

// // const SUBSCRIPTION_PLANS = {
// //     STANDARD: {
// //         name: 'Standard',
// //         slug: 'standard',
// //         price: 0,
// //         currency: 'USD',
// //         billingCycle: 'Forever',
// //         duration: Infinity,
// //         features: {
// //             maxMandates: 1,
// //             maxCapitalAllocation: 10000,
// //             hasIntroTelemetry: true,
// //             hasPlatformBasics: true,
// //             hasAdvancedMandates: false,
// //             hasRiskFramework: false,
// //             hasExecutionJournal: false,
// //             hasStrategyAlerts: false
// //         }
// //     },
// //     PREMIUM: {
// //         name: 'Premium',
// //         slug: 'premium',
// //         type: 'yearly',
// //         price: 24900, // Storing in cents ($249.00)
// //         currency: 'USD',
// //         billingCycle: 'Yearly',
// //         duration: 365,
// //         features: {
// //             maxMandates: 5,
// //             maxCapitalAllocation: 100000,
// //             hasIntroTelemetry: true,
// //             hasPlatformBasics: true,
// //             hasAdvancedMandates: true,       // All institutional mandates
// //             hasRiskFramework: true,       // Complete risk telemetry framework
// //             hasExecutionJournal: false,   // X in terminal view
// //             hasStrategyAlerts: false      // X in terminal view
// //         }
// //     },
// //     INSTITUTIONAL: {
// //         name: 'Institutional',
// //         slug: 'institutional',
// //         type: 'yearly',
// //         price: 34900, // $349.00
// //         currency: 'USD',
// //         billingCycle: 'Yearly',
// //         duration: 365,
// //         features: {
// //             maxMandates: 999,
// //             maxCapitalAllocation: 999999999,
// //             hasIntroTelemetry: true,
// //             hasPlatformBasics: true,
// //             hasAdvancedMandates: true,
// //             hasRiskFramework: true,
// //             hasExecutionJournal: true,    // Included in Institutional
// //             hasStrategyAlerts: true       // Strategy alerts & automated monitors included
// //         }
// //     }
// // };

// // module.exports = SUBSCRIPTION_PLANS;


// const SUBSCRIPTION_PLANS = {
//     'STARTER TIER': {
//         name: 'Starter Tier',
//         slug: 'starter-tier',
//         price: 3000,
//         currency: 'USD',
//         billingCycle: 'Forever',
//         duration: Infinity,
//         features: {
//             maxMandates: 1,
//             maxCapitalAllocation: 3000,
//             hasIntroTelemetry: true,
//             hasPlatformBasics: true,
//             hasAdvancedMandates: false,
//             hasRiskFramework: false,
//             hasExecutionJournal: false,
//             hasStrategyAlerts: false
//         }
//     },
//     'GROWTH TIER': {
//         name: 'Growth Tier',
//         slug: 'growth-tier',
//         price: 5000,
//         currency: 'USD',
//         billingCycle: 'Forever',
//         duration: Infinity,
//         features: {
//             maxMandates: 3,
//             maxCapitalAllocation: 5000,
//             hasIntroTelemetry: true,
//             hasPlatformBasics: true,
//             hasAdvancedMandates: true,
//             hasRiskFramework: true,
//             hasExecutionJournal: false,
//             hasStrategyAlerts: false
//         }
//     },
//     'EXECUTIVE TIER': {
//         name: 'Executive Tier',
//         slug: 'executive-tier',
//         price: 25000,
//         currency: 'USD',
//         billingCycle: 'Yearly',
//         duration: 365,
//         features: {
//             maxMandates: 10,
//             maxCapitalAllocation: 25000,
//             hasIntroTelemetry: true,
//             hasPlatformBasics: true,
//             hasAdvancedMandates: true,
//             hasRiskFramework: true,
//             hasExecutionJournal: true,
//             hasStrategyAlerts: false
//         }
//     },
//     INSTITUTIONAL: {
//         name: 'Institutional',
//         slug: 'institutional',
//         price: 100000,
//         currency: 'USD',
//         billingCycle: 'Yearly',
//         duration: 365,
//         features: {
//             maxMandates: 999,
//             maxCapitalAllocation: 100000,
//             hasIntroTelemetry: true,
//             hasPlatformBasics: true,
//             hasAdvancedMandates: true,
//             hasRiskFramework: true,
//             hasExecutionJournal: true,
//             hasStrategyAlerts: true
//         }
//     }
// };

// module.exports = SUBSCRIPTION_PLANS;


// File: config/plans.js
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