const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const Watchlist = require('../models/Watchlist');
const stockPriceService = require('../services/stockPriceService');
const User = require('../models/User'); 
const Order = require('../models/Order');

// Middleware to check authentication
router.use(requiresAuth());

// Get watchlist page
router.get('/', async (req, res) => {
    try {
        const userEmail = req.oidc.user.email;
        const userId = req.oidc.user.sub;
        
        // Get user data including wallet balance
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            throw new Error('User not found');
        }

        let userWatchlist = await Watchlist.findOne({ userId });
        
        if (!userWatchlist) {
            userWatchlist = new Watchlist({ 
                userId,
                stocks: []
            });
            await userWatchlist.save();
        }

        // Fetch current prices and company info for all stocks in watchlist
        const symbols = userWatchlist.stocks.map(stock => stock.symbol);
        const quotes = await stockPriceService.getBatchQuotes(symbols);
        const companyInfo = await stockPriceService.getCompanyProfile(symbols);

        // Update watchlist with current prices and company info
        const updatedStocks = await Promise.all(userWatchlist.stocks.map(async (stock) => {
            const quote = quotes[stock.symbol] || {};
            const company = await stockPriceService.getCompanyProfile(stock.symbol);
            
            return {
                symbol: stock.symbol,
                name: company.name || stock.name || stock.symbol,
                sector: company.sector || stock.sector || 'N/A',
                lastPrice: quote.price || stock.lastPrice || 0,
                priceChange: quote.change || 0,
                lastUpdated: new Date()
            };
        }));

        userWatchlist.stocks = updatedStocks;
        await userWatchlist.save();

        res.render('watchlist', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: {
                ...req.oidc.user,
                walletBalance: user.walletBalance || 0
            },
            watchlist: updatedStocks,
            error: null
        });
    } catch (error) {
        console.error('Error loading watchlist:', error);
        res.render('watchlist', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: {
                ...req.oidc.user,
                walletBalance: 0
            },
            watchlist: [],
            error: 'Failed to load watchlist'
        });
    }
});

// Add stock to watchlist
router.post('/add', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { symbol, name: providedName, sector: providedSector } = req.body;

        if (!symbol) {
            return res.status(400).json({ 
                success: false, 
                message: 'Stock symbol is required' 
            });
        }

        // Get company info and quote from stock service
        const [companyInfo, quote] = await Promise.all([
            stockPriceService.getCompanyProfile(symbol),
            stockPriceService.getQuote(symbol)
        ]);

        // Use provided data or fallback to API data
        const stockData = {
            symbol,
            name: providedName || (companyInfo && companyInfo.name) || symbol,
            sector: providedSector || (companyInfo && companyInfo.sector) || 'N/A',
            lastPrice: quote ? quote.price : 0,
            priceChange: quote ? quote.change : 0,
            addedAt: new Date(),
            lastUpdated: new Date()
        };

        let userWatchlist = await Watchlist.findOne({ userId });
        
        if (!userWatchlist) {
            userWatchlist = new Watchlist({ userId });
        }

        // Check if stock already exists
        if (userWatchlist.hasStock(symbol)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Stock already in watchlist' 
            });
        }

        // Add stock to watchlist
        userWatchlist.addStock(stockData);
        await userWatchlist.save();

        res.json({ 
            success: true, 
            message: 'Stock added to watchlist',
            stock: stockData
        });
    } catch (error) {
        console.error('Error adding stock to watchlist:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add stock to watchlist' 
        });
    }
});

// Remove stock from watchlist
router.post('/remove', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { symbol } = req.body;

        if (!symbol) {
            return res.status(400).json({ 
                success: false, 
                message: 'Stock symbol is required' 
            });
        }

        const userWatchlist = await Watchlist.findOne({ userId });
        
        if (!userWatchlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Watchlist not found' 
            });
        }

        userWatchlist.removeStock(symbol);
        await userWatchlist.save();
        
        res.json({ success: true, message: 'Stock removed from watchlist' });
    } catch (error) {
        console.error('Error removing stock from watchlist:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to remove stock from watchlist' 
        });
    }
});

// Refresh watchlist prices
router.post('/refresh', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const userWatchlist = await Watchlist.findOne({ userId });

        if (!userWatchlist) {
            return res.json({ success: false, message: 'Watchlist not found' });
        }

        const symbols = userWatchlist.stocks.map(stock => stock.symbol);
        const quotes = await stockPriceService.getBatchQuotes(symbols);

        // Update stock prices and company info
        const updatedStocks = await Promise.all(userWatchlist.stocks.map(async (stock) => {
            const quote = quotes[stock.symbol] || {};
            const company = await stockPriceService.getCompanyProfile(stock.symbol);
            
            return {
                ...stock,
                name: company.name || stock.name || stock.symbol,
                sector: company.sector || stock.sector || 'N/A',
                lastPrice: quote.price || stock.lastPrice || 0,
                priceChange: quote.change || 0,
                lastUpdated: new Date()
            };
        }));

        userWatchlist.stocks = updatedStocks;
        await userWatchlist.save();
        res.json({ success: true, message: 'Watchlist refreshed' });
    } catch (error) {
        console.error('Error refreshing watchlist:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to refresh watchlist' 
        });
    }
});

// Get watchlist data (with real-time stock data)
router.get('/data', requiresAuth(), async (req, res) => {
    try {
        const user = await User.findById(req.oidc.user.sub);
        if (!user || !user.watchlist) {
            return res.json([]);
        }

        const stockPromises = user.watchlist.map(async (stock) => {
            try {
                const quote = await stockPriceService.getQuote(stock.symbol);
                return {
                    symbol: stock.symbol,
                    name: stock.name,
                    price: quote.c ? quote.c.toFixed(2) : '0.00',
                    change: quote.dp ? quote.dp.toFixed(2) : '0.00',
                    high: quote.h ? quote.h.toFixed(2) : '0.00',
                    low: quote.l ? quote.l.toFixed(2) : '0.00',
                    open: quote.o ? quote.o.toFixed(2) : '0.00',
                    prevClose: quote.pc ? quote.pc.toFixed(2) : '0.00',
                    volume: quote.v || 0,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                console.error(`Error fetching data for ${stock.symbol}:`, error);
                return {
                    symbol: stock.symbol,
                    name: stock.name,
                    price: '0.00',
                    change: '0.00',
                    high: '0.00',
                    low: '0.00',
                    open: '0.00',
                    prevClose: '0.00',
                    volume: 0,
                    error: true
                };
            }
        });

        const stockData = await Promise.all(stockPromises);
        res.json(stockData);
    } catch (error) {
        console.error('Error in /watchlist/data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current price for a stock
router.get('/price/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        
        if (!symbol) {
            return res.status(400).json({
                success: false,
                message: 'Stock symbol is required'
            });
        }

        const quote = await stockPriceService.getQuote(symbol);
        
        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Stock price not found'
            });
        }

        res.json({
            success: true,
            price: quote.price,
            change: quote.changePercent
        });
    } catch (error) {
        console.error('Error fetching stock price:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch stock price'
        });
    }
});

// Get watchlist settings
router.get('/settings', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const userWatchlist = await Watchlist.findOne({ userId });
        
        if (!userWatchlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Watchlist not found' 
            });
        }

        res.json({ 
            success: true, 
            settings: userWatchlist.settings 
        });
    } catch (error) {
        console.error('Error fetching watchlist settings:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch watchlist settings' 
        });
    }
});

// Update watchlist settings
router.put('/settings', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { settings } = req.body;

        const userWatchlist = await Watchlist.findOne({ userId });
        
        if (!userWatchlist) {
            return res.status(404).json({ 
                success: false, 
                message: 'Watchlist not found' 
            });
        }

        userWatchlist.settings = {
            ...userWatchlist.settings,
            ...settings
        };
        
        await userWatchlist.save();
        
        res.json({ 
            success: true, 
            message: 'Settings updated successfully' 
        });
    } catch (error) {
        console.error('Error updating watchlist settings:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update watchlist settings' 
        });
    }
});

// Buy stock
router.post('/buy', requiresAuth(), async (req, res) => {
    try {
        const userEmail = req.oidc.user.email;
        const { symbol, quantity, price } = req.body;

        if (!symbol || !quantity || !price) {
            return res.status(400).json({
                success: false,
                message: 'Symbol, quantity, and price are required'
            });
        }

        // Get user and check wallet balance
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const totalCost = price * quantity;
        if (user.walletBalance < totalCost) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient funds',
                required: totalCost,
                available: user.walletBalance
            });
        }

        // Get company info
        const companyInfo = await stockPriceService.getCompanyProfile(symbol);

        // Create new order
        const order = new Order({
            userId: userEmail,
            symbol: symbol,
            companyName: companyInfo.name || symbol,
            type: 'buy',
            quantity: quantity,
            price: price,
            total: totalCost,
            status: 'completed',
            orderDate: new Date()
        });

        // Update user's wallet balance
        user.walletBalance -= totalCost;

        // Save both order and updated user balance
        await Promise.all([
            order.save(),
            user.save()
        ]);

        res.json({
            success: true,
            message: 'Stock purchased successfully',
            order: {
                symbol,
                quantity,
                price,
                total: totalCost,
                newBalance: user.walletBalance
            }
        });
    } catch (error) {
        console.error('Error buying stock:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process stock purchase'
        });
    }
});

module.exports = router;
