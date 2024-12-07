const express = require('express');
const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const portfolioService = require('../services/portfolioService');

const router = express.Router();

// Helper function to calculate portfolio metrics
async function calculatePortfolioMetrics(userId) {
    const orders = await Order.find({ userId, status: 'completed' });
    const symbols = [...new Set(orders.map(order => order.symbol))];
    const quotes = await portfolioService.getBatchQuotes(symbols);
    
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
            profitLossPercent: 0,
            priceChange: quote.change
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

        // Only keep holdings with positive quantities
        if (holding.quantity > 0) {
            holdingsMap.set(order.symbol, holding);
        } else {
            holdingsMap.delete(order.symbol);
        }
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

    return {
        totalInvestment: totals.totalInvestment,
        totalCurrentValue: totals.totalCurrentValue,
        totalProfitLoss: totals.totalProfitLoss,
        totalProfitLossPercent: totals.totalProfitLossPercent,
        holdings
    };
}

// Role-Based Dashboard Route
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

        res.render('user-dashboard', {
            user,
            portfolio: portfolioMetrics,
            transactions: recentTransactions,
            orders: recentOrders
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        await ErrorLog.create({
            userId: req.oidc.user.email,
            error: error.message,
            stack: error.stack,
            route: '/dashboard'
        });
        res.status(500).render('error', { 
            error: 'Error loading dashboard'
        });
    }
});

// Admin Dashboard Route
router.get('/admin/dashboard', async (req, res) => {
    try {
        const users = await User.find(); // Fetch users
        const errorLogs = await ErrorLog.find().sort({ timestamp: -1 }); // Fetch error logs
        const transactions = await Transaction.find().sort({ date: -1 }); // Fetch transactions

        res.render('admin-dashboard', {
            user: req.oidc.user, // Authenticated user details
            users,
            errorLogs,
            transactions,
        });
    } catch (err) {
        console.error('Error fetching admin data:', err);
        res.status(500).send('Internal Server Error');
    }
});

module.exports = router;
