const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const Notification = require('../models/Notification');

// Middleware to check authentication
router.use(requiresAuth());

// Get notifications page
router.get('/', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const notifications = await Notification.find({ 
            userId,
            status: { $ne: 'archived' }
        })
        .sort({ createdAt: -1 })
        .limit(50);

        // Get unread count
        const unreadCount = await Notification.countDocuments({
            userId,
            status: 'unread'
        });
        
        res.render('notifications', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: req.oidc.user,
            notifications,
            unreadCount,
            error: null
        });
    } catch (error) {
        console.error('Error loading notifications:', error);
        res.render('notifications', {
            isAuthenticated: req.oidc.isAuthenticated(),
            user: req.oidc.user,
            notifications: [],
            unreadCount: 0,
            error: 'Failed to load notifications'
        });
    }
});

// Mark notification as read
router.post('/read/:notificationId', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { notificationId } = req.params;

        const notification = await Notification.findOne({ 
            _id: notificationId,
            userId
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        await notification.markAsRead();

        res.json({
            success: true,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read'
        });
    }
});

// Mark all notifications as read
router.post('/read-all', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;

        await Notification.updateMany(
            { userId, status: 'unread' },
            { $set: { status: 'read' } }
        );

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all notifications as read'
        });
    }
});

// Archive notification
router.post('/archive/:notificationId', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        const { notificationId } = req.params;

        const notification = await Notification.findOne({ 
            _id: notificationId,
            userId
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        await notification.archive();

        res.json({
            success: true,
            message: 'Notification archived'
        });
    } catch (error) {
        console.error('Error archiving notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to archive notification'
        });
    }
});

// Get notification count
router.get('/count', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        
        const unreadCount = await Notification.countDocuments({
            userId,
            status: 'unread'
        });

        res.json({
            success: true,
            unreadCount
        });
    } catch (error) {
        console.error('Error getting notification count:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get notification count'
        });
    }
});

// Get notification preferences
router.get('/preferences', async (req, res) => {
    try {
        const userId = req.oidc.user.sub;
        // You would typically get this from a user preferences collection
        // For now, returning default preferences
        res.json({
            success: true,
            preferences: {
                email: true,
                push: true,
                priceAlerts: true,
                orderUpdates: true,
                newsAlerts: true
            }
        });
    } catch (error) {
        console.error('Error getting notification preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get notification preferences'
        });
    }
});

module.exports = router;
