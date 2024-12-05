const cron = require('node-cron');
const marketDataService = require('./marketDataService');

class MarketSchedulerService {
    constructor() {
        // Schedule market close data saving at 4 PM EST every weekday
        // Cron format: Minute Hour * * Day (0-6, where 1-5 is Monday-Friday)
        this.marketCloseJob = cron.schedule('0 16 * * 1-5', async () => {
            console.log('Running market close data save job...');
            try {
                await marketDataService.saveMarketClose();
                console.log('Market close data saved successfully');
            } catch (error) {
                console.error('Error saving market close data:', error);
            }
        }, {
            timezone: "America/New_York"
        });

        // Schedule cache clearing at midnight EST
        this.cacheClearJob = cron.schedule('0 0 * * *', () => {
            console.log('Clearing market data cache...');
            try {
                marketDataService.clearCache();
                console.log('Market data cache cleared successfully');
            } catch (error) {
                console.error('Error clearing market data cache:', error);
            }
        }, {
            timezone: "America/New_York"
        });
    }

    startScheduler() {
        this.marketCloseJob.start();
        this.cacheClearJob.start();
        console.log('Market scheduler started');
    }

    stopScheduler() {
        this.marketCloseJob.stop();
        this.cacheClearJob.stop();
        console.log('Market scheduler stopped');
    }
}

module.exports = new MarketSchedulerService();
