const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const Watchlist = require('../../models/Watchlist');
const stockPriceService = require('../../services/stockPriceService');

// Add stock to watchlist
router.post('/add', requiresAuth(), async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { symbol } = req.body;

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

        if (!quote) {
            return res.status(404).json({
                success: false,
                message: 'Invalid stock symbol'
            });
        }

        const stockData = {
            symbol,
            name: (companyInfo && companyInfo.name) || symbol,
            sector: (companyInfo && companyInfo.sector) || 'N/A',
            lastPrice: quote.price || 0,
            priceChange: quote.change || 0,
            addedAt: new Date(),
            lastUpdated: new Date()
        };

        let userWatchlist = await Watchlist.findOne({ userId });
        
        if (!userWatchlist) {
            userWatchlist = new Watchlist({ userId, stocks: [] });
        }

        // Check if stock already exists
        if (userWatchlist.stocks.some(stock => stock.symbol === symbol)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Stock already in watchlist' 
            });
        }

        // Add stock to watchlist
        userWatchlist.stocks.push(stockData);
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
router.delete('/remove/:symbol', requiresAuth(), async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { symbol } = req.params;

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

        // Find the index of the stock to remove
        const stockIndex = userWatchlist.stocks.findIndex(stock => stock.symbol === symbol);
        
        if (stockIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Stock not found in watchlist'
            });
        }

        // Remove the stock
        userWatchlist.stocks.splice(stockIndex, 1);
        await userWatchlist.save();

        res.json({
            success: true,
            message: 'Stock removed from watchlist'
        });
    } catch (error) {
        console.error('Error removing stock from watchlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove stock from watchlist'
        });
    }
});

// Get user's watchlist
router.get('/', requiresAuth(), async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const userWatchlist = await Watchlist.findOne({ userId });
        
        if (!userWatchlist) {
            return res.json({ stocks: [] });
        }

        // Get updated prices for all stocks
        const updatedStocks = await Promise.all(userWatchlist.stocks.map(async (stock) => {
            try {
                const quote = await stockPriceService.getQuote(stock.symbol);
                return {
                    ...stock.toObject(),
                    lastPrice: quote.price || stock.lastPrice,
                    priceChange: quote.change || stock.priceChange,
                    lastUpdated: new Date()
                };
            } catch (error) {
                console.error(`Error updating price for ${stock.symbol}:`, error);
                return stock;
            }
        }));

        userWatchlist.stocks = updatedStocks;
        await userWatchlist.save();

        res.json({ stocks: updatedStocks });
    } catch (error) {
        console.error('Error fetching watchlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch watchlist'
        });
    }
});

module.exports = router;
