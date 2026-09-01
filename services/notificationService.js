const axios = require('axios');
const logger = require('../config/logger');

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID; 
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

const sendPushNotification = async (playerIds, title, body, data = {}) => {
    // Safety Check
    if (!playerIds || playerIds.length === 0) {
        // logger.warn("⚠️ Push Skipped: No Player IDs provided.");
        return;
    }

    // OneSignal REST API Payload
    const payload = {
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: playerIds, 
        
        // Message Content
        headings: { en: title },
        contents: { en: body },
        
        // 🔗 DEEP LINKING DATA
        data: data, 

        // ⚡ QUEUING & OFFLINE DELIVERY (Fix for Problem #1)
        ttl: 259200, 

        // ⚡ SPEED & VISIBILITY
        priority: 10,            
        android_group_priority: 5, 
        android_visibility: 1, 
        
        // 🔔 ANDROID CHANNELS (Fix for Problem #2)
        // Ensure you have a channel ID set up in OneSignal Dashboard -> Settings -> Messaging -> Android Channels
        // If not, remove this line or set to your specific channel ID.
        // android_channel_id: "your-channel-id-here", 
        
        // 🍎 iOS SETTINGS
        ios_relevance_score: 1.0,
        content_available: true, 
        mutable_content: true,
        ios_sound: "default" 
    };

    try {
        const response = await axios.post(
            'https://onesignal.com/api/v1/notifications',
            payload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${ONESIGNAL_API_KEY}`
                }
            }
        );
        
        // ✅ LOGGING FIX: Check if it actually sent to anyone
        if (response.data.recipients === 0) {
            logger.warn(`⚠️ OneSignal: Sent 0 notifications. Player IDs might be invalid/unsubscribed.`);
        }

        return response.data;
    } catch (error) {
        const errMsg = error.response?.data?.errors?.[0] || error.message;
        logger.error(`OneSignal Error: ${errMsg}`);
        return { success: false, error: errMsg };
    }
};

module.exports = { sendPushNotification };