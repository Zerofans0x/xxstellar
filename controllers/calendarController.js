const asyncHandler = require('express-async-handler');
const EconomicEvent = require('../models/EconomicEvent');

// @desc    Get Weekly Economic Calendar with Filters
// @route   GET /api/v1/psyche/calendar
// @access  Private
const getCalendarEvents = asyncHandler(async (req, res) => {
    // The frontend will send comma-separated arrays for filters 
    // Example: ?impacts=High,Mid&currencies=USD,EUR&eventTypes=Central Bank,Inflation
    const { startDate, endDate, impacts, currencies, eventTypes, search } = req.query;

    // 1. Establish the Date Range (Defaults to current week if not provided)
    const query = {};

    if (startDate && endDate) {
        query.dateUtc = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    } else {
        const today = new Date();
        const first = today.getDate() - today.getDay(); // Sunday
        const last = first + 6; // Saturday

        const firstDay = new Date(today.setDate(first));
        firstDay.setHours(0, 0, 0, 0);
        
        const lastDay = new Date(today.setDate(last));
        lastDay.setHours(23, 59, 59, 999);

        query.dateUtc = { $gte: firstDay, $lte: lastDay };
    }

    // 2. Apply Modal Filters dynamically
    if (impacts) {
        query.impact = { $in: impacts.split(',') };
    }
    if (currencies) {
        query.currency = { $in: currencies.split(',') };
    }
    if (eventTypes) {
        query.eventType = { $in: eventTypes.split(',') };
    }

    // 3. Apply Text Search (From the "Search Event" input)
    if (search) {
        query.title = { $regex: search, $options: 'i' };
    }

    // 4. Fetch and sort chronologically
    const events = await EconomicEvent.find(query).sort({ dateUtc: 1 });

    // 5. Group by Day for the Frontend UI Layout
    const groupedEvents = {};

    events.forEach(event => {
        // Format to match UI exactly: "Thu Aug 13"
        const dateKey = event.dateUtc.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        
        if (!groupedEvents[dateKey]) {
            groupedEvents[dateKey] = [];
        }

        groupedEvents[dateKey].push({
            id: event._id,
            time: event.timeString,
            currency: event.currency,
            title: event.title,
            description: event.description,
            impact: event.impact,
            eventType: event.eventType
        });
    });

    // Convert object to array for clean mapping in Next.js
    const formattedCalendar = Object.keys(groupedEvents).map(date => ({
        dateLabel: date,
        events: groupedEvents[date]
    }));

    res.status(200).json({
        success: true,
        data: formattedCalendar
    });
});

// @desc    Fetch Live Economic Data (Bypassing FMP completely)
// @route   POST /api/v1/psyche/calendar/sync-live
// @access  Private/Admin
const syncLiveCalendarEvents = asyncHandler(async (req, res) => {
    // Forex Factory / Fair Economy public weekly JSON feed (No API key required!)
    const url = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Public feed responded with status: ${response.status}`);
        }

        const liveData = await response.json();

        if (!Array.isArray(liveData) || liveData.length === 0) {
            return res.status(400).json({ success: false, message: "No live data available for this week." });
        }

        let updatedCount = 0;

        for (const item of liveData) {
            // 1. Map Forex Factory's 'Medium' to Dominic's 'Mid' UI tag
            let formattedImpact = item.impact === 'Medium' ? 'Mid' : item.impact;
            if (!formattedImpact || formattedImpact.trim() === '') formattedImpact = 'Low'; 
            
            // 2. Map 'country' to currency, and parse dates
            const currency = item.country;
            const dateObj = new Date(item.date);
            const timeString = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
            
            // 3. Simple UI mapping for event types based on title keywords
            let eventType = 'Other';
            const titleLower = item.title.toLowerCase();
            if (titleLower.includes('cpi') || titleLower.includes('inflation')) eventType = 'Inflation';
            else if (titleLower.includes('employment') || titleLower.includes('nfp') || titleLower.includes('unemployment') || titleLower.includes('payroll')) eventType = 'Employment';
            else if (titleLower.includes('gdp') || titleLower.includes('production') || titleLower.includes('sales')) eventType = 'Growth';
            else if (titleLower.includes('fed') || titleLower.includes('ecb') || titleLower.includes('boe') || titleLower.includes('rate')) eventType = 'Central Bank';
            else if (titleLower.includes('speech') || titleLower.includes('speaks')) eventType = 'Speeches';
            else if (titleLower.includes('housing') || titleLower.includes('building')) eventType = 'Housing';

            // Create a unique deterministic ID
            const uniqueEventId = `${currency}-${dateObj.getTime()}-${item.title.replace(/\s+/g, '-')}`;

            await EconomicEvent.findOneAndUpdate(
                { eventId: uniqueEventId }, 
                {
                    $set: {
                        eventId: uniqueEventId,
                        title: item.title,
                        currency: currency,
                        impact: formattedImpact,
                        eventType: eventType,
                        dateUtc: dateObj,
                        timeString: timeString,
                        actual: item.actual || '',
                        forecast: item.forecast || '',
                        previous: item.previous || ''
                    }
                },
                { upsert: true, returnDocument: 'after' }
            );
            updatedCount++;
        }

        res.status(200).json({
            success: true,
            message: `Successfully pulled and synced ${updatedCount} live economic events from the public feed.`
        });

    } catch (error) {
        console.error("Live Data Fetch Error Details:", error);
        res.status(500);
        throw new Error(`Failed to pull live data: ${error.message}`);
    }
});


module.exports = {
    getCalendarEvents,
    syncLiveCalendarEvents
};