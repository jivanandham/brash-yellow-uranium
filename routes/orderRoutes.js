const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const Order = require('../models/Order');
const PaperTradingAccount = require('../models/PaperTradingAccount');
const User = require('../models/User');
const stockPriceService = require('../services/stockPriceService');

// Middleware to ensure user has a paper trading account
router.use(async (req, res, next) => {
    try {
        const userId = req.oidc.user.sub;
        let account = await PaperTradingAccount.findOne({ userId });
        
        if (!account) {
            account = new PaperTradingAccount({ userId });
            await account.save();
        }
        
        req.paperTradingAccount = account;
        next();
    } catch (error) {
        next(error);
    }
});

// Middleware to check authentication
router.use(requiresAuth());

// Get orders page
router.get('/', async (req, res) => {
    try {
        const userEmail = req.oidc.user.email;
        const userId = req.oidc.user.sub;

        // Get user data including wallet balance
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            throw new Error('User not found');
        }

        // Get all orders for the user
        const orders = await Order.find({ 
            userId: userId,
            status: 'completed' 
        }).sort({ createdAt: -1 });

        const account = await PaperTradingAccount.findOne({ userId });
        
        // Calculate holdings from the account
        const holdings = account ? account.holdings.map(holding => ({
            symbol: holding.symbol,
            quantity: holding.quantity,
            averagePrice: holding.averagePrice,
            totalInvestment: holding.quantity * holding.averagePrice,
            currentPrice: 0, // Will be updated with real-time data
            currentValue: 0, // Will be updated with real-time data
            profitLoss: 0 // Will be updated with real-time data
        })) : [];

        // Get current prices for all holdings
        if (holdings.length > 0) {
            const symbols = holdings.map(h => h.symbol);
            const quotes = await Promise.all(
                symbols.map(symbol => stockPriceService.getQuote(symbol))
            );

            // Update holdings with current prices and calculations
            holdings.forEach((holding, index) => {
                const quote = quotes[index];
                if (quote) {
                    holding.currentPrice = quote.c;
                    holding.currentValue = holding.quantity * quote.c;
                    holding.profitLoss = holding.currentValue - holding.totalInvestment;
                }
            });
        }

        res.render('orders', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: {
                ...req.oidc.user,
                walletBalance: user.walletBalance || 0
            },
            orders: orders,
            holdings: holdings,
            account: account,
            error: null
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        res.render('orders', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: {
                ...req.oidc.user,
                walletBalance: 0
            },
            orders: [],
            holdings: [],
            account: null,
            error: 'Failed to load orders'
        });
    }
});

// Filter orders API endpoint
router.get('/filter', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { type, status } = req.query;
        
        // Build filter query
        const filter = { userId };
        if (type) filter.type = type;
        if (status) filter.status = status;

        const orders = await Order.find(filter).sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Error filtering orders:', error);
        res.status(500).json({ success: false, error: 'Error filtering orders' });
    }
});

// Place new order
router.post('/place', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { symbol, companyName, type, quantity } = req.body;
        const account = req.paperTradingAccount;

        // Validate input
        if (!symbol || !companyName || !type || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Get real-time price from Alpha Vantage
        const quote = await stockPriceService.getQuote(symbol);
        if (!quote) {
            return res.status(400).json({
                success: false,
                message: 'Failed to fetch current price'
            });
        }

        // Create new order with real-time price
        const order = new Order({
            userId,
            symbol,
            companyName,
            type,
            quantity: Number(quantity),
            price: quote.price,
            total: Number(quantity) * quote.price
        });

        // Execute order on paper trading account
        try {
            if (type === 'buy') {
                await account.executeBuyOrder(symbol, companyName, Number(quantity), quote.price);
            } else {
                const result = await account.executeSellOrder(symbol, Number(quantity), quote.price);
                order.profitLoss = result.profitLoss;
            }
            order.status = 'completed';
            order.executedDate = new Date();
        } catch (tradeError) {
            order.status = 'failed';
            order.notes = tradeError.message;
            return res.status(400).json({
                success: false,
                message: tradeError.message
            });
        }

        await order.save();
        await account.save();

        res.json({
            success: true,
            order: order
        });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to place order'
        });
    }
});

// Cancel order
router.post('/cancel/:orderId', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { orderId } = req.params;

        const order = await Order.findOne({ _id: orderId, userId });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.status === 'pending') {
            order.status = 'cancelled';
            await order.save();
            res.json({
                success: true,
                message: 'Order cancelled successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled'
            });
        }
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel order'
        });
    }
});

// Get order history with filters
router.get('/history', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { status, type, startDate, endDate } = req.query;

        let query = { userId };

        if (status) query.status = status;
        if (type) query.type = type;
        if (startDate || endDate) {
            query.orderDate = {};
            if (startDate) query.orderDate.$gte = new Date(startDate);
            if (endDate) query.orderDate.$lte = new Date(endDate);
        }

        const orders = await Order.find(query)
            .sort({ orderDate: -1 })
            .limit(100);

        res.json({
            success: true,
            orders
        });
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch order history'
        });
    }
});

// Get account information
router.get('/account', async (req, res) => {
    try {
        const account = req.paperTradingAccount;
        res.json({
            success: true,
            account: {
                balance: account.balance,
                holdings: account.holdings,
                totalProfitLoss: account.totalProfitLoss,
                portfolioValue: account.calculatePortfolioValue()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch account information'
        });
    }
});

module.exports = router;
