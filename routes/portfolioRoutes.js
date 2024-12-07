const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const Order = require('../models/Order');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const portfolioService = require('../services/portfolioService');
const stockPriceService = require('../services/stockPriceService');

// Middleware to check authentication
router.use(requiresAuth());

// Get portfolio page
router.get('/', async (req, res) => {
    try {
        const userEmail = req.oidc.user.email;
        
        // Get user data
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            throw new Error('User not found');
        }

        // Get portfolio metrics using centralized service
        const portfolioMetrics = await portfolioService.calculatePortfolioMetrics(userEmail);

        // Get recent transactions
        const recentTransactions = await Transaction.find({ userEmail })
            .sort({ timestamp: -1 })
            .limit(5);

        // Get recent orders
        const recentOrders = await Order.find({ userId: userEmail })
            .sort({ orderDate: -1 })
            .limit(5);

        res.render('portfolio', {
            user,
            portfolio: portfolioMetrics,
            transactions: recentTransactions,
            orders: recentOrders,
            isAuthenticated: true
        });
    } catch (error) {
        console.error('Portfolio error:', error);
        res.render('error', { 
            error: 'Error loading portfolio data',
            isAuthenticated: true
        });
    }
});

// Get portfolio data (API endpoint)
router.get('/api/data', async (req, res) => {
    try {
        const userEmail = req.oidc.user.email;
        const portfolioMetrics = await portfolioService.calculatePortfolioMetrics(userEmail);
        res.json({
            success: true,
            portfolio: portfolioMetrics
        });
    } catch (error) {
        console.error('Portfolio API error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching portfolio data'
        });
    }
});

// Buy stock route
router.post('/buy', async (req, res) => {
    try {
        const { symbol, quantity, price } = req.body;

        // Validate input
        if (!symbol || !quantity || !price) {
            return res.status(400).json({
                success: false,
                message: 'Symbol, quantity, and price are required'
            });
        }

        const totalCost = quantity * price;

        // Get user and check balance
        const user = await User.findOne({ email: req.oidc.user.email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.walletBalance < totalCost) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient funds'
            });
        }

        // Get company info
        const companyInfo = await stockPriceService.getCompanyProfile(symbol);

        // Create order
        const order = new Order({
            userId: user.email,
            symbol,
            companyName: companyInfo.name,
            type: 'buy',
            quantity,
            price,
            total: totalCost,
            status: 'completed',
            orderDate: new Date()
        });

        // Update user balance using findOneAndUpdate
        const updatedUser = await User.findOneAndUpdate(
            { email: user.email },
            { $inc: { walletBalance: -totalCost } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update wallet balance'
            });
        }

        // Create transaction record
        const transaction = new Transaction({
            userEmail: user.email,
            type: 'trade',
            amount: -totalCost,
            balance: updatedUser.walletBalance,
            description: `Purchased ${quantity} shares of ${symbol}`,
            stockSymbol: symbol,
            tradeType: 'buy'
        });

        // Save order and transaction
        await Promise.all([
            order.save(),
            transaction.save()
        ]);

        // Get updated portfolio metrics
        const portfolioMetrics = await portfolioService.calculatePortfolioMetrics(user.email);

        res.json({
            success: true,
            message: 'Stock purchased successfully',
            order: {
                symbol,
                quantity,
                price,
                total: totalCost
            },
            newBalance: updatedUser.walletBalance,
            portfolio: portfolioMetrics
        });
    } catch (error) {
        console.error('Buy stock error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing buy order'
        });
    }
});

module.exports = router;
