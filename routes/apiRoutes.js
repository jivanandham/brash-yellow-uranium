const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const stockPriceService = require('../services/stockPriceService');

// Get stock quote
router.get('/stock/quote', requiresAuth(), async (req, res) => {
    try {
        const { symbol } = req.query;
        if (!symbol) {
            return res.status(400).json({
                error: true,
                message: 'Stock symbol is required'
            });
        }

        const quote = await stockPriceService.getQuote(symbol);
        res.json({
            symbol: quote.symbol,
            name: quote.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            volume: quote.volume,
            lastUpdated: quote.lastUpdated
        });
    } catch (error) {
        console.error('Error fetching stock quote:', error.message);
        
        if (error.message === 'API rate limit exceeded. Please try again later.') {
            return res.status(429).json({
                error: true,
                message: 'Too many requests. Please try again in a minute.'
            });
        }

        if (error.message === 'No quote data available') {
            return res.status(404).json({
                error: true,
                message: 'Stock not found. Please check the symbol and try again.'
            });
        }

        res.status(500).json({
            error: true,
            message: 'Failed to fetch stock quote. Please try again later.'
        });
    }
});

module.exports = router;
