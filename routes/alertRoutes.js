const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const Alert = require('../models/Alert');

// Middleware to check authentication
router.use(requiresAuth());

// Get alerts page
router.get('/', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const alerts = await Alert.find({ userId }).sort({ createdAt: -1 });
        
        res.render('alerts', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: req.oidc.user,
            alerts,
            error: null
        });
    } catch (error) {
        console.error('Error loading alerts:', error);
        res.render('alerts', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: req.oidc.user,
            alerts: [],
            error: 'Failed to load alerts'
        });
    }
});

// Create new alert
router.post('/create', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { symbol, companyName, type, price, currentPrice } = req.body;

        // Validate input
        if (!symbol || !companyName || !type || !price || !currentPrice) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Check for existing active alert for the same stock and condition
        const existingAlert = await Alert.findOne({
            userId,
            symbol,
            type,
            status: 'active',
            price: Number(price)
        });

        if (existingAlert) {
            return res.status(400).json({
                success: false,
                message: 'An identical alert already exists'
            });
        }

        // Create new alert
        const alert = new Alert({
            userId,
            symbol,
            companyName,
            type,
            price: Number(price),
            currentPrice: Number(currentPrice)
        });

        await alert.save();

        res.json({
            success: true,
            message: 'Alert created successfully',
            alert
        });
    } catch (error) {
        console.error('Error creating alert:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create alert'
        });
    }
});

// Cancel alert
router.post('/cancel/:alertId', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { alertId } = req.params;

        const alert = await Alert.findOne({ _id: alertId, userId });

        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        if (alert.status === 'active') {
            alert.status = 'cancelled';
            await alert.save();
            res.json({
                success: true,
                message: 'Alert cancelled successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Alert cannot be cancelled'
            });
        }
    } catch (error) {
        console.error('Error cancelling alert:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel alert'
        });
    }
});

// Get alert history
router.get('/history', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { status, type, symbol } = req.query;

        let query = { userId };

        if (status) query.status = status;
        if (type) query.type = type;
        if (symbol) query.symbol = symbol;

        const alerts = await Alert.find(query)
            .sort({ createdAt: -1 })
            .limit(100);

        res.json({
            success: true,
            alerts
        });
    } catch (error) {
        console.error('Error fetching alert history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch alert history'
        });
    }
});

module.exports = router;
