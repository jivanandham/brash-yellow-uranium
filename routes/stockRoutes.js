const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const stockPriceService = require('../services/stockPriceService');

// Middleware to check authentication
router.use(requiresAuth());

// Search stocks
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) {
            return res.json({
                success: false,
                message: 'Search query must be at least 2 characters'
            });
        }

        const results = await stockPriceService.searchStocks(query);
        
        // Get current prices for the found stocks
        const symbols = results.map(stock => stock.symbol);
        const quotes = await stockPriceService.getBatchQuotes(symbols);

        // Combine stock info with current prices
        const stocksWithPrices = results.map(stock => {
            const quote = quotes[stock.symbol] || {};
            return {
                symbol: stock.symbol,
                name: stock.name,
                sector: stock.sector || 'N/A',
                price: quote.price || 0,
                change: quote.change || 0,
                changePercent: quote.changePercent || 0
            };
        });

        res.json({
            success: true,
            results: stocksWithPrices
        });
    } catch (error) {
        console.error('Stock search error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search stocks'
        });
    }
});

// Get stock details
router.get('/details/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const stockInfo = await stockPriceService.getCompanyProfile(symbol);
        const quote = await stockPriceService.getQuote(symbol);

        if (!stockInfo || !quote) {
            return res.status(404).json({
                success: false,
                message: 'Stock not found'
            });
        }

        res.json({
            success: true,
            stock: {
                symbol: symbol,
                name: stockInfo.name,
                sector: stockInfo.sector,
                price: quote.price,
                change: quote.change,
                changePercent: quote.changePercent,
                marketCap: stockInfo.marketCap,
                volume: quote.volume,
                peRatio: stockInfo.peRatio
            }
        });
    } catch (error) {
        console.error('Stock details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get stock details'
        });
    }
});

// Get watchlist
router.get('/watchlist', async (req, res) => {
    try {
        // Get user's watchlist from database
        const watchlist = await req.user.watchlist || [];
        
        // Get current prices for watchlist stocks
        const quotes = await stockPriceService.getBatchQuotes(watchlist.map(stock => stock.symbol));
        
        // Combine watchlist with current prices
        const watchlistWithPrices = watchlist.map(stock => {
            const quote = quotes[stock.symbol] || {};
            return {
                ...stock,
                price: quote.price || 0,
                change: quote.change || 0,
                changePercent: quote.changePercent || 0
            };
        });

        res.json({
            success: true,
            watchlist: watchlistWithPrices
        });
    } catch (error) {
        console.error('Get watchlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get watchlist'
        });
    }
});

// Add to watchlist
router.post('/watchlist', async (req, res) => {
    try {
        const { symbol, name } = req.body;
        
        if (!symbol || !name) {
            return res.status(400).json({
                success: false,
                message: 'Symbol and name are required'
            });
        }

        // Check if stock exists and get current data
        const quote = await stockPriceService.getQuote(symbol);
        const profile = await stockPriceService.getCompanyProfile(symbol);
        
        if (!quote || !profile) {
            return res.status(404).json({
                success: false,
                message: 'Stock not found'
            });
        }

        // Add to user's watchlist in database
        if (!req.user.watchlist) {
            req.user.watchlist = [];
        }

        // Check if stock is already in watchlist
        const existingStock = req.user.watchlist.find(stock => stock.symbol === symbol);
        if (existingStock) {
            return res.status(400).json({
                success: false,
                message: 'Stock is already in watchlist'
            });
        }

        // Add stock to watchlist
        req.user.watchlist.push({
            symbol,
            name,
            sector: profile.sector || 'N/A',
            addedAt: new Date()
        });

        // Save user
        await req.user.save();

        res.json({
            success: true,
            message: 'Stock added to watchlist',
            stock: {
                symbol,
                name,
                sector: profile.sector || 'N/A',
                price: quote.price,
                change: quote.change,
                changePercent: quote.changePercent
            }
        });
    } catch (error) {
        console.error('Add to watchlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add stock to watchlist'
        });
    }
});

// Remove from watchlist
router.delete('/watchlist/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        
        if (!req.user.watchlist) {
            return res.status(404).json({
                success: false,
                message: 'Watchlist not found'
            });
        }

        // Remove stock from watchlist
        req.user.watchlist = req.user.watchlist.filter(stock => stock.symbol !== symbol);
        
        // Save user
        await req.user.save();

        res.json({
            success: true,
            message: 'Stock removed from watchlist'
        });
    } catch (error) {
        console.error('Remove from watchlist error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove stock from watchlist'
        });
    }
});

module.exports = router;
