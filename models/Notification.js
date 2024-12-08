const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['alert', 'order', 'system', 'info', 'success', 'warning', 'error'],
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
    icon: {
        type: String,
        default: 'fas fa-bell'
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
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
notificationSchema.index({ userId: 1, status: 1, createdAt: -1 });

// Method to mark notification as read
notificationSchema.methods.markAsRead = async function() {
    this.status = 'read';
    this.updatedAt = new Date();
    return await this.save();
};

// Method to archive notification
notificationSchema.methods.archive = async function() {
    this.status = 'archived';
    this.updatedAt = new Date();
    return await this.save();
};

// Static method to create a notification
notificationSchema.statics.createNotification = async function(userId, title, message, type = 'info', priority = 'medium') {
    const notification = new this({
        userId,
        title,
        message,
        type,
        priority,
        icon: getIconForType(type)
    });
    return await notification.save();
};

// Helper function to get icon based on notification type
function getIconForType(type) {
    const icons = {
        info: 'fas fa-info-circle',
        success: 'fas fa-check-circle',
        warning: 'fas fa-exclamation-triangle',
        error: 'fas fa-times-circle',
        alert: 'fas fa-bell',
        order: 'fas fa-shopping-cart',
        system: 'fas fa-cog'
    };
    return icons[type] || icons.info;
}

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
