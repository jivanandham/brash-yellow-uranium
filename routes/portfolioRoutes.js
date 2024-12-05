const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const Order = require('../models/Order');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const stockPriceService = require('../services/stockPriceService');

// Middleware to check authentication
router.use(requiresAuth());

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
            userId: user.email, // Use email as userId for consistency
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

        res.json({
            success: true,
            message: 'Stock purchased successfully',
            order: {
                symbol,
                quantity,
                price,
                total: totalCost
            },
            newBalance: updatedUser.walletBalance
        });
    } catch (error) {
        console.error('Error buying stock:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to purchase stock'
        });
    }
});

// Get portfolio page
router.get('/', async (req, res) => {
    try {
        const userEmail = req.oidc.user.email;
        const orders = await Order.find({ userId: userEmail, status: 'completed' });
        
        // Get all unique symbols from orders
        const symbols = [...new Set(orders.map(order => order.symbol))];
        const quotes = await stockPriceService.getBatchQuotes(symbols);
        
        // Calculate holdings
        const holdingsMap = new Map();
        
        // Process all orders chronologically
        orders.sort((a, b) => a.createdAt - b.createdAt).forEach(order => {
            const quote = quotes[order.symbol];
            if (!quote) return;

            let holding = holdingsMap.get(order.symbol) || {
                symbol: order.symbol,
                companyName: order.companyName,
                quantity: 0,
                avgPrice: 0,
                totalInvestment: 0,
                currentPrice: quote.price,
                currentValue: 0,
                profitLoss: 0,
                profitLossPercent: 0
            };

            if (order.type === 'buy') {
                // Update holding for buy orders
                const newQuantity = holding.quantity + order.quantity;
                const newInvestment = holding.totalInvestment + (order.quantity * order.price);
                
                holding.quantity = newQuantity;
                holding.totalInvestment = newInvestment;
                holding.avgPrice = newInvestment / newQuantity;
            } else if (order.type === 'sell') {
                // Update holding for sell orders
                const newQuantity = holding.quantity - order.quantity;
                // Calculate the portion of investment being sold
                const soldInvestment = (order.quantity / holding.quantity) * holding.totalInvestment;
                holding.totalInvestment -= soldInvestment;
                holding.quantity = newQuantity;
                
                if (newQuantity > 0) {
                    holding.avgPrice = holding.totalInvestment / newQuantity;
                } else {
                    // If all shares are sold, remove from holdings
                    holdingsMap.delete(order.symbol);
                    return;
                }
            }

            // Update current values
            holding.currentValue = holding.quantity * quote.price;
            holding.profitLoss = holding.currentValue - holding.totalInvestment;
            holding.profitLossPercent = (holding.profitLoss / holding.totalInvestment) * 100;

            holdingsMap.set(order.symbol, holding);
        });

        const holdings = Array.from(holdingsMap.values());

        // Calculate portfolio totals
        const totals = holdings.reduce((acc, holding) => {
            acc.totalInvestment += holding.totalInvestment;
            acc.totalCurrentValue += holding.currentValue;
            acc.totalProfitLoss += holding.profitLoss;
            return acc;
        }, {
            totalInvestment: 0,
            totalCurrentValue: 0,
            totalProfitLoss: 0
        });

        totals.totalProfitLossPercent = totals.totalInvestment > 0 
            ? (totals.totalProfitLoss / totals.totalInvestment) * 100 
            : 0;

        res.render('portfolio', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: req.oidc.user,
            holdings,
            totals
        });
    } catch (error) {
        console.error('Error loading portfolio:', error);
        res.render('portfolio', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: req.oidc.user,
            holdings: [],
            totals: {
                totalInvestment: 0,
                totalCurrentValue: 0,
                totalProfitLoss: 0,
                totalProfitLossPercent: 0
            },
            error: 'Error loading portfolio'
        });
    }
});

module.exports = router;
