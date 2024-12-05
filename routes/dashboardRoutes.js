const express = require('express');
const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const stockPriceService = require('../services/stockPriceService');

const router = express.Router();

// Helper function to calculate portfolio metrics
async function calculatePortfolioMetrics(userId) {
    const orders = await Order.find({ userId, status: 'completed' });
    const symbols = [...new Set(orders.map(order => order.symbol))];
    const quotes = await stockPriceService.getBatchQuotes(symbols);
    
    let totalInvestment = 0;
    let totalCurrentValue = 0;
    let holdings = [];

    // Calculate totals and create holdings array
    orders.forEach(order => {
        if (order.type === 'buy') {
            const quote = quotes[order.symbol];
            if (quote) {
                const currentValue = order.quantity * quote.price;
                const investment = order.quantity * order.price;
                totalInvestment += investment;
                totalCurrentValue += currentValue;

                // Add to holdings
                const existingHolding = holdings.find(h => h.symbol === order.symbol);
                if (existingHolding) {
                    existingHolding.quantity += order.quantity;
                    existingHolding.investment += investment;
                    existingHolding.currentValue = existingHolding.quantity * quote.price;
                } else {
                    holdings.push({
                        symbol: order.symbol,
                        companyName: order.companyName,
                        quantity: order.quantity,
                        investment: investment,
                        currentValue: currentValue,
                        currentPrice: quote.price,
                        priceChange: quote.change
                    });
                }
            }
        }
    });

    // Calculate profit/loss for each holding
    holdings = holdings.map(holding => ({
        ...holding,
        profitLoss: holding.currentValue - holding.investment,
        profitLossPercent: ((holding.currentValue - holding.investment) / holding.investment) * 100
    }));

    return {
        totalInvestment,
        totalCurrentValue,
        totalProfitLoss: totalCurrentValue - totalInvestment,
        totalProfitLossPercent: ((totalCurrentValue - totalInvestment) / totalInvestment) * 100,
        holdings
    };
}

// Role-Based Dashboard Route
router.get('/', async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.redirect('/login');
    }

    try {
        const user = await User.findOne({ email: req.oidc.user.email });
        if (!user) {
            return res.status(403).send('User not found');
        }

        if (user.role === 'admin') {
            const users = await User.find();
            const errorLogs = await ErrorLog.find().sort({ timestamp: -1 });
            const transactions = await Transaction.find().sort({ date: -1 });

            return res.render('admin-dashboard', {
                user,
                users,
                errorLogs,
                transactions
            });
        } else {
            // Calculate portfolio metrics for user dashboard
            const portfolio = await calculatePortfolioMetrics(req.oidc.user.sub);
            
            return res.render('user-dashboard', { 
                user,
                portfolio
            });
        }
    } catch (err) {
        console.error('Error fetching user or rendering dashboard:', err);
        res.status(500).send('Internal Server Error');
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
