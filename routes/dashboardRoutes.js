const express = require('express');
const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');
const portfolioService = require('../services/portfolioService');
const { isAdmin, isUser } = require('../middleware/roleMiddleware');

const router = express.Router();

// Main dashboard route - redirects based on role
router.get('/', async (req, res) => {
    if (!req.oidc.isAuthenticated()) {
        return res.redirect('/login');
    }

    try {
        const user = await User.findOne({ email: req.oidc.user.email });
        if (!user) {
            return res.redirect('/login');
        }

        if (user.role === 'admin') {
            res.redirect('/admin');
        } else {
            res.redirect('/dashboard/user');
        }
    } catch (error) {
        console.error('Dashboard routing error:', error);
        res.status(500).render('error', {
            message: 'Error accessing dashboard',
            error,
            isAuthenticated: true
        });
    }
});

// User Dashboard
router.get('/user', isUser, async (req, res) => {
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
        console.error('User dashboard error:', error);
        await ErrorLog.create({
            userId: req.oidc.user.email,
            error: error.message,
            stack: error.stack,
            route: '/dashboard/user'
        });
        res.status(500).render('error', { 
            error: 'Error loading dashboard',
            isAuthenticated: true
        });
    }
});

// Admin Dashboard
router.get('/admin', isAdmin, async (req, res) => {
    try {
        const userEmail = req.oidc.user.email;
        
        // Get admin user data
        const admin = await User.findOne({ email: userEmail });
        if (!admin) {
            throw new Error('Admin not found');
        }

        // Get system statistics
        const totalUsers = await User.countDocuments({ role: 'user' });
        const totalTransactions = await Transaction.countDocuments();
        const totalOrders = await Order.countDocuments();
        
        // Get recent error logs
        const recentErrors = await ErrorLog.find()
            .sort({ timestamp: -1 })
            .limit(10);

        // Get recent user registrations
        const recentUsers = await User.find({ role: 'user' })
            .sort({ createdAt: -1 })
            .limit(5);

        res.render('admin-dashboard', {
            admin,
            stats: {
                totalUsers,
                totalTransactions,
                totalOrders
            },
            recentErrors,
            recentUsers,
            isAuthenticated: true
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        await ErrorLog.create({
            userId: req.oidc.user.email,
            error: error.message,
            stack: error.stack,
            route: '/dashboard/admin'
        });
        res.status(500).render('error', { 
            error: 'Error loading admin dashboard',
            isAuthenticated: true
        });
    }
});

module.exports = router;
