const cron = require('node-cron');
const EconomicEvent = require('../models/EconomicEvent');

const initializeCronJobs = () => {
    
    // Schedule: Runs at 01:00 AM every single day
    cron.schedule('0 1 * * *', async () => {
        console.log(`[CRON] Initiating live economic data sync at ${new Date().toLocaleString()}`);

        try {
            // Public feed URL
            const url = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`Feed error: ${response.status}`);
            
            const liveData = await response.json();

            if (liveData && liveData.length > 0) {
                let updatedCount = 0;

                for (const item of liveData) {
                    // 1. Format Impact
                    let formattedImpact = item.impact === 'Medium' ? 'Mid' : item.impact;
                    if (!formattedImpact || formattedImpact.trim() === '') formattedImpact = 'Low'; 
                    
                    // 2. Map Country to Currency & Parse Dates
                    const currency = item.country;
                    const dateObj = new Date(item.date);
                    const timeString = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
                    
                    // 3. UI Tag Mapping based on Title
                    let eventType = 'Other';
                    const titleLower = item.title.toLowerCase();
                    if (titleLower.includes('cpi') || titleLower.includes('inflation')) eventType = 'Inflation';
                    else if (titleLower.includes('employment') || titleLower.includes('nfp') || titleLower.includes('unemployment') || titleLower.includes('payroll')) eventType = 'Employment';
                    else if (titleLower.includes('gdp') || titleLower.includes('production') || titleLower.includes('sales')) eventType = 'Growth';
                    else if (titleLower.includes('fed') || titleLower.includes('ecb') || titleLower.includes('boe') || titleLower.includes('rate')) eventType = 'Central Bank';
                    else if (titleLower.includes('speech') || titleLower.includes('speaks')) eventType = 'Speeches';
                    else if (titleLower.includes('housing') || titleLower.includes('building')) eventType = 'Housing';

                    // 4. Create deterministic ID
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
                                forecast: item.forecast || '', // Fixed mapping
                                previous: item.previous || ''
                            }
                        },
                        { upsert: true, new: true }
                    );
                    updatedCount++;
                }
                console.log(`[CRON SUCCESS] Synced ${updatedCount} live economic events for the week.`);
            }
        } catch (error) {
            console.error("[CRON ERROR] Failed to fetch live calendar data:", error.message);
        }
    }, {
        scheduled: true,
        timezone: "Africa/Lagos" 
    });

    console.log('[SYSTEM] Background Cron jobs initialized.');
};

module.exports = { initializeCronJobs };