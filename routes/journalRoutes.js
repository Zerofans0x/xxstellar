// const express = require('express');
// const router = express.Router();
// const { authenticate } = require('../middleware/authMiddleware');
// const { 
//     createTradingAccount,
//     webhookMtSync,
//     getJournalDashboard,
//     getTradesForDay,
//     getJournalInsights,
//     getPnLShareCardData,
//     addManualTrade
// } = require('../controllers/journalController');

// // 🚨 PUBLIC WEBHOOK (Secured internally via x-sync-token header)
// router.post('/mt-sync', webhookMtSync);

// // ==========================================
// // PROTECTED ROUTES (Requires JWT)
// // ==========================================
// router.use(authenticate);

// // Account Connections
// router.post('/account', createTradingAccount);

// // Dashboard & Insights
// router.get('/dashboard', getJournalDashboard);
// router.get('/day/:dateStr', getTradesForDay);
// router.get('/insights', getJournalInsights);
// router.get('/share-card', getPnLShareCardData);

// // Manual Trade Entries
// router.post('/trades', addManualTrade);

// module.exports = router;


const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { 
    connectBrokerAccount,
    syncAccountTrades,
    getJournalDashboard,
    getTradesForDay,
    getJournalInsights,
    getPnLShareCardData,
    addManualTrade
} = require('../controllers/journalController');

router.use(authenticate);

// Account Connections
router.post('/account/connect', connectBrokerAccount);
router.post('/account/sync', syncAccountTrades);

// Dashboard & Insights
router.get('/dashboard', getJournalDashboard);
router.get('/day/:dateStr', getTradesForDay);
router.get('/insights', getJournalInsights);
router.get('/share-card', getPnLShareCardData);

// Manual Trade Entries
router.post('/trades', addManualTrade);

module.exports = router;