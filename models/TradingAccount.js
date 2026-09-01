// // models/TradingAccount.js
// const mongoose = require('mongoose');
// const crypto = require('crypto'); // Built-in Node module

// const TradingAccountSchema = new mongoose.Schema({
//     user: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User',
//         required: true
//     },
//     platform: {
//         type: String,
//         enum: ['MetaTrader 4', 'MetaTrader 5', 'Manual'],
//         default: 'MetaTrader 5'
//     },
//     accountNumber: {
//         type: String,
//         required: true
//     },
//     syncToken: {
//         type: String, // The EA will use this to authenticate
//         unique: true,
//         default: () => crypto.randomBytes(16).toString('hex') 
//     },
//     lastSyncedAt: {
//         type: Date
//     }
// }, { timestamps: true });

// module.exports = mongoose.model('TradingAccount', TradingAccountSchema);



const mongoose = require('mongoose');
const crypto = require('crypto'); // Built-in Node module

const TradingAccountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    platform: {
        type: String,
        enum: ['MetaTrader 4', 'MetaTrader 5', 'Manual'],
        default: 'MetaTrader 5'
    },
    accountNumber: {
        type: String,
        required: true
    },
    brokerServer: {
        type: String,
        required: true
    },
    investorPassword: {
        type: String,
        required: true
    },
    metaApiAccountId: {
        type: String,
        required: true,
        unique: true
    },
    syncStatus: {
        type: String,
        enum: ['CONNECTED', 'DISCONNECTED', 'SYNCING'],
        default: 'DISCONNECTED'
    },
    syncToken: {
        type: String, // The EA will use this to authenticate if needed
        unique: true,
        default: () => crypto.randomBytes(16).toString('hex') 
    },
    lastSyncedAt: {
        type: Date
    }
}, { timestamps: true });

module.exports = mongoose.model('TradingAccount', TradingAccountSchema);