const NodeCache = require('node-cache');
const stockPriceService = require('./stockPriceService');
const Stock = require('../models/Stock');

// Cache with 5 minute TTL
const marketCache = new NodeCache({ stdTTL: 300 });

class MarketDataService {
    constructor() {
        this.CACHE_KEYS = {
            TOP_GAINERS: 'top_gainers',
            TOP_LOSERS: 'top_losers',
            MOST_POPULAR: 'most_popular',
            MOST_TRADED: 'most_traded'
        };
    }

    async getTopGainers(limit = 5) {
        let gainers = marketCache.get(this.CACHE_KEYS.TOP_GAINERS);
        if (gainers) return gainers;

        const stocks = await Stock.find()
            .sort({ changePercent: -1 })
            .limit(limit)
            .lean();

        if (stocks.length === 0) {
            gainers = await this.fetchRealTimeTopStocks('gainers', limit);
        } else {
            gainers = stocks;
        }

        marketCache.set(this.CACHE_KEYS.TOP_GAINERS, gainers);
        return gainers;
    }

    async getTopLosers(limit = 5) {
        let losers = marketCache.get(this.CACHE_KEYS.TOP_LOSERS);
        if (losers) return losers;

        const stocks = await Stock.find()
            .sort({ changePercent: 1 })
            .limit(limit)
            .lean();

        if (stocks.length === 0) {
            losers = await this.fetchRealTimeTopStocks('losers', limit);
        } else {
            losers = stocks;
        }

        marketCache.set(this.CACHE_KEYS.TOP_LOSERS, losers);
        return losers;
    }

    async getMostPopular(limit = 5) {
        let popular = marketCache.get(this.CACHE_KEYS.MOST_POPULAR);
        if (popular) return popular;

        // Get most watched stocks from your database
        popular = await Stock.aggregate([
            {
                $lookup: {
                    from: 'watchlists',
                    localField: 'symbol',
                    foreignField: 'stocks.symbol',
                    as: 'watchers'
                }
            },
            {
                $addFields: {
                    watchCount: { $size: '$watchers' }
                }
            },
            {
                $sort: { watchCount: -1 }
            },
            {
                $limit: limit
            }
        ]);

        marketCache.set(this.CACHE_KEYS.MOST_POPULAR, popular);
        return popular;
    }

    async getMostTraded(limit = 5) {
        let traded = marketCache.get(this.CACHE_KEYS.MOST_TRADED);
        if (traded) return traded;

        // Get most traded stocks based on order history
        traded = await Stock.aggregate([
            {
                $lookup: {
                    from: 'orders',
                    localField: 'symbol',
                    foreignField: 'symbol',
                    as: 'trades'
                }
            },
            {
                $addFields: {
                    tradeCount: { $size: '$trades' }
                }
            },
            {
                $sort: { tradeCount: -1 }
            },
            {
                $limit: limit
            }
        ]);

        marketCache.set(this.CACHE_KEYS.MOST_TRADED, traded);
        return traded;
    }

    async saveMarketClose() {
        const now = new Date();
        const marketCloseHour = 16; // 4 PM

        if (now.getHours() === marketCloseHour) {
            try {
                // Get all tracked stocks
                const stocks = await Stock.find();
                
                // Update closing prices
                for (const stock of stocks) {
                    const quote = await stockPriceService.getQuote(stock.symbol);
                    if (quote) {
                        stock.previousPrice = stock.currentPrice;
                        stock.currentPrice = quote.price;
                        stock.priceChange = quote.price - stock.previousPrice;
                        stock.changePercent = (stock.priceChange / stock.previousPrice) * 100;
                        stock.volume = quote.volume;
                        stock.lastUpdated = now;
                        await stock.save();
                    }
                }

                // Clear cache after market close
                marketCache.flushAll();
                
                console.log('Market close data saved successfully');
            } catch (error) {
                console.error('Error saving market close data:', error);
            }
        }
    }

    async fetchRealTimeTopStocks(type, limit) {
        try {
            // Implement real-time stock fetching logic here using stockPriceService
            // This is a placeholder - you'll need to implement based on your data provider
            const stocks = await stockPriceService.getTopStocks(type, limit);
            return stocks;
        } catch (error) {
            console.error(`Error fetching ${type} stocks:`, error);
            return [];
        }
    }

    clearCache() {
        marketCache.flushAll();
        console.log('Market data cache cleared');
    }
}

module.exports = new MarketDataService();
