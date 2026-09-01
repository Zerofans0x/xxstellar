const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const mongoose = require('mongoose');

// --- Load Config & Connectors ---
const connectDB = require('./config/db');
const { initializeCronJobs } = require('./services/cronService');
const { notFound } = require('./middleware/errorMiddleware');
const logger = require('./config/logger');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const { globalLimiter } = require('./middleware/ratelimiters');

dotenv.config();

const startServer = async () => {
    try {
        await connectDB();

        // --- API Route Imports ---
        const authRoutes = require('./routes/authRoutes');
        const psycheRoutes = require('./routes/psycheRoutes');  
        const publicRoutes = require('./routes/publicRoutes');
        const adminCourseRoutes = require('./routes/admin/adminCourseRoutes');
        const adminRoutes = require('./routes/admin/adminRoutes');
        const adminCertificateRoutes = require('./routes/admin/adminCertificateRoutes');
        const adminModerationRoutes = require('./routes/admin/adminModerationRoutes');

        const app = express();
        const server = http.createServer(app);
        // Boot up the background workers
        initializeCronJobs();

        // 1. Socket.io Configuration (AWS Optimized)
        const io = new Server(server, {
            cors: { 
                origin: "*", 
                methods: ["GET", "POST"],
                credentials: true 
            },
            // ⚠️ CRITICAL: Allow both, but mobile will force 'websocket'
            transports: ['websocket', 'polling'], 
            allowEIO3: true,
            pingInterval: 25000, 
            pingTimeout: 20000,  
        });

        app.set('socketio', io);

        // 🟢 2. Socket Authentication Middleware
        io.use((socket, next) => {
            const token = socket.handshake.auth.token;
            const userId = socket.handshake.auth.userId; 

            // Log handshake for debugging
            console.log(`🔌 Socket Handshake: ${socket.id} | User: ${userId || 'Anon'}`);

            if (!token) {
                // For debugging, we log but don't crash. In strict prod, return next(new Error(...))
                console.log(`⚠️ No token provided for socket ${socket.id}`);
            }

            if (userId) {
                socket.userId = userId.toString().trim();
            }
            next();
        });

        // 🟢 3. Connection Handler
        io.on('connection', (socket) => {
            if (socket.userId) {
                socket.join(socket.userId);
                console.log(`👤 User joined room: ${socket.userId}`);
            }

            socket.on('disconnect', (reason) => {
                console.log(`🔴 Disconnect: ${socket.id} (${reason})`);
            });
        });

        // --- Express Middlewares ---
        app.set('trust proxy', 1);
        app.use(helmet());
        app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

        const allowedOrigins = [
            'http://localhost:5173',
            process.env.MYSTELLARTERM_FRONTEND_URL
        ];

        app.use(cors({
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.indexOf(origin) !== -1) {
                    callback(null, true);
                } else {
                    callback(null, true); // Temporarily allow all for debugging mobile
                }
            },
            credentials: true,
        }));

        app.use(express.json({ limit: '10mb' })); 
        app.use(express.urlencoded({ extended: false }));
        app.use(cookieParser());

        // --- Session Management ---
        app.use(session({
            secret: process.env.SESSION_SECRET,
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: 1000 * 60 * 60 * 24 * 7
            }
        }));

        app.use(passport.initialize());
        require('./config/passport-setup');

        // --- Routes ---
        app.get('/health', (req, res) => res.status(200).send('OK'));

        // 🧪 Manual Socket Test Route
        app.post('/api/v1/debug/socket-test', (req, res) => {
            const { userId, type } = req.body;
            const ioInstance = req.app.get('socketio');
            
            if (userId) {
                const targetId = userId.toString().trim();
                ioInstance.to(targetId).emit('system_update', { 
                    type: type || 'DATA_REFRESH',
                    note: `Manual test for user: ${targetId}` 
                });
                console.log(`🧪 Manual test sent to room: ${targetId}`);
            }
            res.status(200).json({ success: true });
        });

        app.use('/api/v1', globalLimiter);
        app.use('/api/v1/auth', authRoutes);
        app.use('/api/v1/psyche', psycheRoutes);
        app.use('/api/v1/admin', adminRoutes);
        app.use('/api/v1/admin', adminCourseRoutes);
        app.use('/api/v1/admin/certificates', adminCertificateRoutes);
        app.use('/api/v1/admin/moderation', adminModerationRoutes);
        app.use('/api/v1/public', publicRoutes);
        app.use(notFound);
        // middleware/errorMiddleware.js (or inside server.js)

app.use((err, req, res, next) => {
    // 1. Determine status
    const statusCode = err.status || (res.statusCode === 200 ? 500 : res.statusCode);
    
    // 2. 🚨 LOG IT! (This was missing in your code)
    // Without this, you will never see the error in AWS CloudWatch or Terminal
    console.error("🔥 ERROR:", err.message);
    if (statusCode === 500) {
        console.error(err.stack); 
    }

    res.status(statusCode);

    // 3. Send JSON response
    res.json({
        success: false,
        // For now, ALWAYS show the real message so we can fix the bug
        message: err.message, 
        // Show stack trace unless we are strictly in production
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});
        // --- Start Server ---
        const PORT = process.env.PORT || 5001;
        server.listen(PORT, () => {
            logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
        });

    } catch (error) {
        logger.error('💥 Failed to start server', error);
        process.exit(1);
    }
};

startServer();