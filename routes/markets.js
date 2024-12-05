const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const stockPriceService = require('../services/stockPriceService');
const marketDataService = require('../services/marketDataService');

// Middleware to check authentication
router.use(requiresAuth());

// List of popular stocks to display
const POPULAR_STOCKS = [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corporation' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.' },
    { symbol: 'META', name: 'Meta Platforms Inc.' },
    { symbol: 'TSLA', name: 'Tesla Inc.' },
    { symbol: 'NVDA', name: 'NVIDIA Corporation' },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
    { symbol: 'V', name: 'Visa Inc.' },
    { symbol: 'JNJ', name: 'Johnson & Johnson' }
];

// Get stocks page
router.get('/stocks', async (req, res) => {
    try {
        // Get market summary data
        const [topGainers, topLosers, mostPopular, mostTraded] = await Promise.all([
            marketDataService.getTopGainers(),
            marketDataService.getTopLosers(),
            marketDataService.getMostPopular(),
            marketDataService.getMostTraded()
        ]);

        // Get quotes for all stocks
        const symbols = POPULAR_STOCKS.map(stock => stock.symbol);
        const quotes = await stockPriceService.getBatchQuotes(symbols);

        // Combine stock info with quotes
        const stocks = POPULAR_STOCKS.map(stock => {
            const quote = quotes[stock.symbol] || {};
            return {
                symbol: stock.symbol,
                name: stock.name,
                price: quote.price || 0,
                change: quote.dp || 0, // Daily percentage change
                marketCap: formatMarketCap(quote.marketCap || 0)
            };
        });

        res.render('markets/stocks', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: req.oidc.user,
            stocks,
            marketSummary: {
                topGainers,
                topLosers,
                mostPopular,
                mostTraded
            }
        });
    } catch (error) {
        console.error('Error loading stocks:', error);
        res.render('markets/stocks', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: req.oidc.user,
            stocks: [],
            marketSummary: {
                topGainers: [],
                topLosers: [],
                mostPopular: [],
                mostTraded: []
            },
            error: 'Error loading stock data'
        });
    }
});

// Helper function to format market cap
function formatMarketCap(marketCap) {
    if (marketCap >= 1e12) {
        return `$${(marketCap / 1e12).toFixed(1)}T`;
    } else if (marketCap >= 1e9) {
        return `$${(marketCap / 1e9).toFixed(1)}B`;
    } else if (marketCap >= 1e6) {
        return `$${(marketCap / 1e6).toFixed(1)}M`;
    } else {
        return `$${marketCap.toFixed(0)}`;
    }
}

router.get('/etf', (req, res) => {
    res.render('markets/etf', {
        user: req.oidc.user,
        path: '/markets/etf'
    });
});

router.get('/mutual-funds', (req, res) => {
    res.render('markets/mutual-funds', {
        user: req.oidc.user,
        path: '/markets/mutual-funds'
    });
});

router.get('/gold', (req, res) => {
    res.render('markets/gold', {
        user: req.oidc.user,
        path: '/markets/gold'
    });
});

router.get('/currency', (req, res) => {
    res.render('markets/currency', {
        user: req.oidc.user,
        path: '/markets/currency'
    });
});

router.get('/commodity', (req, res) => {
    res.render('markets/commodity', {
        user: req.oidc.user,
        path: '/markets/commodity'
    });
});

module.exports = router;
