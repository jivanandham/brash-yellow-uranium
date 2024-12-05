const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['alert', 'order', 'system', 'price', 'news'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['unread', 'read', 'archived'],
        default: 'unread'
    },
    link: {
        type: String
    },
    metadata: {
        symbol: String,
        price: Number,
        orderId: String,
        alertId: String
    },
    expiresAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Index for faster queries
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Method to mark notification as read
notificationSchema.methods.markAsRead = function() {
    this.status = 'read';
    return this.save();
};

// Method to archive notification
notificationSchema.methods.archive = function() {
    this.status = 'archived';
    return this.save();
};

// Static method to create a price alert notification
notificationSchema.statics.createPriceAlert = async function(userId, symbol, price, alertType, message) {
    return this.create({
        userId,
        type: 'price',
        title: `Price Alert: ${symbol}`,
        message,
        priority: 'high',
        metadata: {
            symbol,
            price
        },
        link: '/orders'
    });
};

// Static method to create an order notification
notificationSchema.statics.createOrderNotification = async function(userId, orderId, status, symbol, quantity, price) {
    const title = `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`;
    const message = `Your order for ${quantity} shares of ${symbol} at $${price} has been ${status}.`;
    
    return this.create({
        userId,
        type: 'order',
        title,
        message,
        priority: 'high',
        metadata: {
            orderId,
            symbol,
            price
        },
        link: '/orders'
    });
};

// Static method to create a system notification
notificationSchema.statics.createSystemNotification = async function(userId, title, message, priority = 'medium') {
    return this.create({
        userId,
        type: 'system',
        title,
        message,
        priority
    });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
