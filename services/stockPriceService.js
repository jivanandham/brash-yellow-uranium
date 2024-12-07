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
            console.log(`Fetching quote for symbol: ${symbol}`);
            
            // Check cache first
            const cached = this.cache.get(symbol);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log(`Using cached data for ${symbol}:`, cached.data);
                return cached.data;
            }

            // Get last known price from database
            const stock = await Stock.findOne({ symbol: symbol.toUpperCase() });
            console.log(`Last known stock data for ${symbol}:`, stock);

            // Make API request
            const response = await this.queueRequest(async () => {
                console.log(`Making API request for ${symbol}`);
                return await axios.get(`${this.baseUrl}/quote`, {
                    params: {
                        symbol: symbol.toUpperCase(),
                        token: this.finnhubKey
                    },
                    timeout: 5000
                });
            });

            console.log(`API response for ${symbol}:`, response.data);

            if (!response.data || typeof response.data.c !== 'number' || response.data.c === 0) {
                console.log(`Invalid API response for ${symbol}, using fallback`);
                if (stock) {
                    const fallbackData = {
                        symbol: stock.symbol,
                        price: stock.currentPrice || 0,
                        change: stock.priceChange || 0,
                        changePercent: stock.changePercent || 0,
                        lastUpdated: stock.lastUpdated || new Date(),
                        isFallback: true
                    };
                    console.log(`Using fallback data for ${symbol}:`, fallbackData);
                    return fallbackData;
                }
                throw new Error(`Invalid price data received for ${symbol}`);
            }

            const currentPrice = response.data.c;
            const previousPrice = response.data.pc || currentPrice;
            const priceChange = response.data.d || (currentPrice - previousPrice);
            const changePercent = response.data.dp || ((priceChange / previousPrice) * 100);

            const stockData = {
                symbol: symbol.toUpperCase(),
                price: currentPrice,
                previousPrice,
                change: priceChange,
                changePercent,
                lastUpdated: new Date()
            };

            console.log(`Processed stock data for ${symbol}:`, stockData);

            // Update caches
            this.cache.set(symbol, {
                timestamp: Date.now(),
                data: stockData
            });

            // Update database
            try {
                if (!stock) {
                    const newStock = new Stock({
                        symbol: symbol.toUpperCase(),
                        currentPrice,
                        previousPrice,
                        priceChange,
                        changePercent,
                        lastUpdated: new Date()
                    });
                    await newStock.save();
                    console.log(`Created new stock record for ${symbol}`);
                } else {
                    stock.currentPrice = currentPrice;
                    stock.previousPrice = previousPrice;
                    stock.priceChange = priceChange;
                    stock.changePercent = changePercent;
                    stock.lastUpdated = new Date();
                    await stock.save();
                    console.log(`Updated stock record for ${symbol}`);
                }
            } catch (dbError) {
                console.error(`Error updating database for ${symbol}:`, dbError);
                // Don't throw here, we still want to return the stock data
            }

            return stockData;
        } catch (error) {
            console.error(`Error fetching quote for ${symbol}:`, error);
            // Try to use cached data as fallback
            const cached = this.cache.get(symbol);
            if (cached) {
                console.log(`Using stale cache as fallback for ${symbol}:`, cached.data);
                return cached.data;
            }
            throw error;
        }
    }

    async getBatchQuotes(symbols) {
        console.log('Getting batch quotes for symbols:', symbols);
        
        if (!Array.isArray(symbols) || symbols.length === 0) {
            console.log('No symbols provided for batch quotes');
            return {};
        }

        const quotes = {};
        const chunks = [];
        for (let i = 0; i < symbols.length; i += 5) {  
            chunks.push(symbols.slice(i, i + 5));
        }

        console.log(`Processing ${chunks.length} chunks of symbols`);

        for (const chunk of chunks) {
            console.log('Processing chunk:', chunk);
            await Promise.all(chunk.map(async (symbol) => {
                try {
                    const quote = await this.getQuote(symbol);
                    quotes[symbol] = quote;
                    console.log(`Successfully got quote for ${symbol}:`, quote);
                } catch (error) {
                    console.error(`Error fetching quote for ${symbol}:`, error.message);
                    // Use a reasonable fallback value
                    quotes[symbol] = {
                        symbol,
                        price: 0,
                        change: 0,
                        changePercent: 0,
                        lastUpdated: new Date(),
                        isFallback: true
                    };
                }
            }));
            
            // Add a small delay between chunks to avoid rate limiting
            if (chunks.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        console.log('Final quotes object:', quotes);
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
