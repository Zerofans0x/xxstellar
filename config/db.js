// const mongoose = require('mongoose');

// const connectDB = async () => {
//     try {
//         mongoose.set('strictQuery', true);
        
//         const conn = await mongoose.connect(process.env.MONGO_URI, {
//             maxPoolSize: 50,   
//             serverSelectionTimeoutMS: 5000, 
//         });
        
//         console.log(`MongoDB Connected: ${conn.connection.host}`);
//     } catch (error) {
//         console.error(`Error connecting to MongoDB: ${error.message}`);
//         process.exit(1);
//     }
// };

// module.exports = connectDB;


const mongoose = require('mongoose');
const dns = require('dns');

// Force Node.js to prioritize IPv4 over IPv6 for Atlas DNS lookup
dns.setDefaultResultOrder('ipv4first');

const connectDB = async () => {
    try {
        mongoose.set('strictQuery', true);
        
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            maxPoolSize: 50,   
            serverSelectionTimeoutMS: 30000, // Increased from 5000ms to allow DNS/TLS handshake
            connectTimeoutMS: 30000,
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;