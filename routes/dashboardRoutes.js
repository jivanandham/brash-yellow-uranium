const express = require('express');
const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const portfolioService = require('../services/portfolioService');

const router = express.Router();

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
            orders: recentOrders,
            isAuthenticated: true
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
            error: 'Error loading dashboard',
            isAuthenticated: true
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
            isAuthenticated: true
        });
    } catch (err) {
        console.error('Error fetching admin data:', err);
        res.status(500).render('error', { 
            error: 'Error loading admin dashboard',
            isAuthenticated: true
        });
    }
});

// Refresh portfolio data (API endpoint)
router.get('/api/portfolio/refresh', async (req, res) => {
    try {
        const userEmail = req.oidc.user.email;
        const portfolioMetrics = await portfolioService.calculatePortfolioMetrics(userEmail);
        res.json({
            success: true,
            portfolio: portfolioMetrics
        });
    } catch (error) {
        console.error('Portfolio refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Error refreshing portfolio data'
        });
    }
});

module.exports = router;
