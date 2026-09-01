const logger = require('../config/logger');

// --- 1. Not Found (404) Handler ---
const notFound = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

// --- 2. Central Error Handler ---
const errorHandler = (err, req, res, next) => {
    // Determine the status code
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);

    logger.error(
        `${statusCode} - ${err.message} - Path: ${req.originalUrl} - Method: ${req.method} - IP: ${req.ip}`,
        { 
            // Include context and stack trace as metadata in the log
            message: err.message,
            stack: err.stack,
            path: req.originalUrl,
            method: req.method,
            ip: req.ip,
            status: statusCode,
            // Log user ID if available (e.g., from req.user set by Passport)
            userId: req.user ? req.user._id : 'N/A' 
        }
    );

    // Send the response to the client
    res.json({
        message: err.message,
        // Only expose the stack trace in development
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = { notFound, errorHandler };