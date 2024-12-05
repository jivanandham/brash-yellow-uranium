const axios = require('axios');
const Stock = require('../models/Stock');

class StockPriceService {
    constructor() {
        this.finnhubKey = 'crk4pehr01qq23fguq10crk4pehr01qq23fguq1g';
        this.baseUrl = 'https://finnhub.io/api/v1';
        this.cache = new Map();
        this.globalQuoteCache = new Map(); // Global cache for consistent prices
        this.companyCache = new Map();
        this.cacheTimeout = 60000; // 1 minute in milliseconds
        this.globalCacheTimeout = 60000; // 1 minute in milliseconds
        this.companyCacheTimeout = 86400000; // 24 hours in milliseconds
    }

    async getQuote(symbol) {
        try {
            if (!symbol) {
                throw new Error('Symbol is required');
            }

            // Check global cache first
            const globalCachedData = this.globalQuoteCache.get(symbol);
            if (globalCachedData && Date.now() - globalCachedData.timestamp < this.globalCacheTimeout) {
                console.log(`Returning global cached data for ${symbol}`);
                return globalCachedData.data;
            }

            // Check regular cache
            const cachedData = this.cache.get(symbol);
            if (cachedData && Date.now() - cachedData.timestamp < this.cacheTimeout) {
                console.log(`Returning cached data for ${symbol}`);
                // Update global cache
                this.globalQuoteCache.set(symbol, cachedData);
                return cachedData.data;
            }

            // Get stock from database
            let stock = await Stock.findOne({ symbol: symbol.toUpperCase() });
            
            // If it's time to refresh the price (1 minute passed)
            if (!stock || !stock.lastUpdated || Date.now() - stock.lastUpdated.getTime() >= this.cacheTimeout) {
                console.log(`Fetching fresh data for ${symbol}`);

                const config = {
                    headers: {
                        'X-Finnhub-Token': this.finnhubKey
                    }
                };

                const response = await axios.get(
                    `${this.baseUrl}/quote?symbol=${symbol.toUpperCase()}`,
                    config
                );

                if (!response.data) {
                    throw new Error('No data received from API');
                }

                const quoteData = response.data;
                
                // Check if we got valid price data
                if (typeof quoteData.c !== 'number' || quoteData.c === 0) {
                    if (!stock) {
                        throw new Error('Invalid price data received');
                    }
                    // Use last known price if available
                    console.log(`Warning: No fresh data for ${symbol}, using last known price`);
                    return {
                        symbol: stock.symbol,
                        price: stock.currentPrice,
                        change: stock.changePercent,
                        lastUpdated: stock.lastUpdated
                    };
                }

                const currentPrice = quoteData.c;
                const previousPrice = quoteData.pc || currentPrice;
                const priceChange = currentPrice - previousPrice;
                const changePercent = previousPrice ? (priceChange / previousPrice) * 100 : 0;

                const stockData = {
                    symbol: symbol.toUpperCase(),
                    price: currentPrice,
                    previousPrice: previousPrice,
                    change: priceChange,
                    changePercent: changePercent,
                    lastUpdated: new Date()
                };

                // Update both caches
                this.cache.set(symbol, {
                    timestamp: Date.now(),
                    data: stockData
                });
                this.globalQuoteCache.set(symbol, {
                    timestamp: Date.now(),
                    data: stockData
                });

                // Update database
                if (!stock) {
                    stock = new Stock({
                        symbol: symbol.toUpperCase(),
                        currentPrice: currentPrice,
                        previousPrice: previousPrice,
                        priceChange: priceChange,
                        changePercent: changePercent,
                        lastUpdated: new Date()
                    });
                } else {
                    stock.currentPrice = currentPrice;
                    stock.previousPrice = previousPrice;
                    stock.priceChange = priceChange;
                    stock.changePercent = changePercent;
                    stock.lastUpdated = new Date();
                }
                await stock.save();

                return stockData;
            }

            // Return cached database data
            return {
                symbol: stock.symbol,
                price: stock.currentPrice,
                change: stock.changePercent,
                lastUpdated: stock.lastUpdated
            };
        } catch (error) {
            console.error('Error in getQuote:', error);
            throw error;
        }
    }

    async getBatchQuotes(symbols) {
        const quotes = {};
        for (const symbol of symbols) {
            try {
                const quote = await this.getQuote(symbol);
                quotes[symbol] = quote;
            } catch (error) {
                console.error(`Error fetching quote for ${symbol}:`, error.message);
                quotes[symbol] = null;
            }
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return quotes;
    }

    async getCompanyProfile(symbol) {
        try {
            if (!symbol) {
                throw new Error('Symbol is required');
            }

            // Check company cache first
            const cachedData = this.companyCache.get(symbol);
            if (cachedData && Date.now() - cachedData.timestamp < this.companyCacheTimeout) {
                console.log(`Returning cached company data for ${symbol}`);
                return cachedData.data;
            }

            console.log(`Fetching company profile for ${symbol}`);
            const config = {
                headers: {
                    'X-Finnhub-Token': this.finnhubKey
                }
            };

            const response = await axios.get(`${this.baseUrl}/stock/profile2?symbol=${symbol}`, config);
            
            if (!response.data) {
                throw new Error('No company data available');
            }

            const companyData = {
                name: response.data.name || symbol,
                sector: response.data.finnhubIndustry || 'N/A',
                country: response.data.country || 'N/A',
                exchange: response.data.exchange || 'N/A',
                currency: response.data.currency || 'USD'
            };

            // Update company cache
            this.companyCache.set(symbol, {
                timestamp: Date.now(),
                data: companyData
            });

            return companyData;
        } catch (error) {
            console.error(`Error fetching company profile for ${symbol}:`, error.message);
            // Return basic data if API call fails
            return {
                name: symbol,
                sector: 'N/A',
                country: 'N/A',
                exchange: 'N/A',
                currency: 'USD'
            };
        }
    }

    async getCompanyInfo(symbols) {
        try {
            if (!Array.isArray(symbols)) {
                throw new Error('Symbols must be an array');
            }

            const profiles = {};
            await Promise.all(symbols.map(async (symbol) => {
                const profile = await this.getCompanyProfile(symbol);
                profiles[symbol] = profile;
            }));

            return profiles;
        } catch (error) {
            console.error('Error fetching company info:', error.message);
            return {};
        }
    }

    calculateProfitLoss(order) {
        const currentValue = order.quantity * order.currentPrice;
        const investmentValue = order.quantity * order.purchasePrice;
        const profitLoss = currentValue - investmentValue;
        const profitLossPercent = (profitLoss / investmentValue) * 100;

        return {
            currentValue,
            profitLoss,
            profitLossPercent
        };
    }

    clearCache() {
        this.cache.clear();
        this.globalQuoteCache.clear();
        this.companyCache.clear();
    }
}

module.exports = new StockPriceService();
