const axios = require('axios');
const Stock = require('../models/Stock');

class StockPriceService {
    constructor() {
        this.finnhubKey = process.env.FINNHUB_API_KEY;
        this.baseUrl = 'https://finnhub.io/api/v1';
        
        // Initialize caches
        this.cache = new Map();
        this.globalQuoteCache = new Map();
        this.companyCache = new Map();
        
        // Cache timeouts
        this.cacheTimeout = 60000; // 1 minute
        this.globalCacheTimeout = 60000; // 1 minute
        this.companyCacheTimeout = 86400000; // 24 hours
        
        // Rate limiting
        this.requestCount = 0;
        this.requestResetTime = Date.now();
        this.requestLimit = 30; // Finnhub's rate limit per second
        this.requestQueue = [];
        this.isProcessingQueue = false;
    }

    async checkRateLimit() {
        const now = Date.now();
        if (now - this.requestResetTime >= 1000) {
            this.requestCount = 0;
            this.requestResetTime = now;
        }

        if (this.requestCount >= this.requestLimit) {
            const waitTime = 1000 - (now - this.requestResetTime);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.requestCount = 0;
            this.requestResetTime = Date.now();
        }

        this.requestCount++;
    }

    async processRequestQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const { request, resolve, reject } = this.requestQueue.shift();
            try {
                await this.checkRateLimit();
                const response = await request();
                resolve(response);
            } catch (error) {
                reject(error);
            }
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between requests
        }

        this.isProcessingQueue = false;
    }

    queueRequest(requestFn) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                request: requestFn,
                resolve,
                reject
            });
            this.processRequestQueue();
        });
    }

    async getQuote(symbol) {
        try {
            if (!symbol) {
                throw new Error('Symbol is required');
            }

            // Check global cache first
            const globalCachedData = this.globalQuoteCache.get(symbol);
            if (globalCachedData && Date.now() - globalCachedData.timestamp < this.globalCacheTimeout) {
                return globalCachedData.data;
            }

            // Check regular cache
            const cachedData = this.cache.get(symbol);
            if (cachedData && Date.now() - cachedData.timestamp < this.cacheTimeout) {
                this.globalQuoteCache.set(symbol, cachedData);
                return cachedData.data;
            }

            // Get stock from database as fallback
            let stock = await Stock.findOne({ symbol: symbol.toUpperCase() });
            
            // Fetch fresh data with rate limiting
            const response = await this.queueRequest(async () => {
                return axios.get(`${this.baseUrl}/quote`, {
                    params: {
                        symbol: symbol.toUpperCase(),
                        token: this.finnhubKey
                    },
                    timeout: 5000
                });
            });

            if (!response.data || typeof response.data.c !== 'number' || response.data.c === 0) {
                if (stock) {
                    // Use last known price as fallback
                    return {
                        symbol: stock.symbol,
                        price: stock.currentPrice,
                        change: stock.priceChange,
                        changePercent: stock.changePercent,
                        lastUpdated: stock.lastUpdated,
                        isFallback: true
                    };
                }
                throw new Error('Invalid price data received');
            }

            const currentPrice = response.data.c;
            const previousPrice = response.data.pc || currentPrice;
            const priceChange = currentPrice - previousPrice;
            const changePercent = (priceChange / previousPrice) * 100;

            const stockData = {
                symbol: symbol.toUpperCase(),
                price: currentPrice,
                previousPrice,
                change: priceChange,
                changePercent,
                lastUpdated: new Date()
            };

            // Update caches
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
                    currentPrice,
                    previousPrice,
                    priceChange,
                    changePercent,
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
        } catch (error) {
            console.error('Error in getQuote:', error);
            throw error;
        }
    }

    async getBatchQuotes(symbols) {
        if (!Array.isArray(symbols) || symbols.length === 0) {
            return {};
        }

        const quotes = {};
        const chunks = [];
        for (let i = 0; i < symbols.length; i += 10) {
            chunks.push(symbols.slice(i, i + 10));
        }

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (symbol) => {
                try {
                    const quote = await this.getQuote(symbol);
                    quotes[symbol] = quote;
                } catch (error) {
                    console.error(`Error fetching quote for ${symbol}:`, error.message);
                    quotes[symbol] = null;
                }
            }));
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
                return cachedData.data;
            }

            console.log(`Fetching company profile for ${symbol}`);

            const response = await this.queueRequest(async () => {
                return axios.get(`${this.baseUrl}/stock/profile2`, {
                    params: {
                        symbol: symbol,
                        token: this.finnhubKey
                    },
                    timeout: 5000
                });
            });
            
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

    async searchStocks(query) {
        try {
            if (!query) {
                throw new Error('Search query is required');
            }

            // Search for stocks
            const response = await this.queueRequest(async () => {
                return axios.get(`${this.baseUrl}/search`, {
                    params: {
                        q: encodeURIComponent(query),
                        token: this.finnhubKey
                    },
                    timeout: 5000
                });
            });

            if (!response.data || !response.data.result) {
                console.log('No search results from API');
                return [];
            }

            console.log('Raw search results:', response.data.result);

            // Filter and format results
            const results = response.data.result
                .filter(item => {
                    // Only include stocks with valid symbols (allow numbers and dots)
                    return item.type === 'Common Stock' && 
                           item.symbol && 
                           item.description;
                })
                .slice(0, 10) // Limit to top 10 results
                .map(item => ({
                    symbol: item.symbol,
                    name: item.description || item.displaySymbol || item.symbol
                }));

            console.log('Filtered results:', results);

            // Get company profiles for each result
            const resultsWithProfiles = await Promise.all(
                results.map(async (stock) => {
                    try {
                        console.log(`Fetching data for ${stock.symbol}`);
                        const quote = await this.getQuote(stock.symbol);
                        if (!quote || !quote.price) {
                            console.log(`No quote data for ${stock.symbol}`);
                            return null;
                        }
                        const profile = await this.getCompanyProfile(stock.symbol);
                        console.log(`Got profile for ${stock.symbol}:`, profile);
                        
                        return {
                            ...stock,
                            sector: profile.sector || 'N/A',
                            price: quote.price,
                            change: quote.changePercent
                        };
                    } catch (error) {
                        console.error(`Error fetching data for ${stock.symbol}:`, error.message);
                        return null;
                    }
                })
            );

            // Filter out null results (failed to get data)
            const finalResults = resultsWithProfiles.filter(stock => stock !== null);
            console.log('Final results:', finalResults);
            return finalResults;
        } catch (error) {
            console.error('Error in searchStocks:', error);
            throw error;
        }
    }
}

module.exports = new StockPriceService();
