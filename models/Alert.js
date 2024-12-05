const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    symbol: {
        type: String,
        required: true
    },
    companyName: {
        type: String,
        required: true
    },
    alertType: {
        type: String,
        enum: ['price', 'stopLoss', 'takeProfit'],
        required: true
    },
    condition: {
        type: String,
        enum: ['above', 'below'],
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    currentPrice: {
        type: Number,
        required: true,
        min: 0
    },
    purchasePrice: {
        type: Number,
        min: 0
    },
    quantity: {
        type: Number,
        min: 0
    },
    stopLossPercentage: {
        type: Number,
        min: 0,
        max: 100
    },
    takeProfitPercentage: {
        type: Number,
        min: 0
    },
    status: {
        type: String,
        enum: ['active', 'triggered', 'cancelled'],
        default: 'active'
    },
    triggerDate: {
        type: Date
    },
    notificationSent: {
        type: Boolean,
        default: false
    },
    notificationMethod: {
        type: String,
        enum: ['email', 'push', 'both'],
        default: 'email'
    }
}, {
    timestamps: true
});

// Method to check if alert should be triggered
alertSchema.methods.shouldTrigger = function(currentPrice) {
    if (this.status !== 'active') return false;
    
    switch (this.alertType) {
        case 'price':
            if (this.condition === 'above') {
                return currentPrice >= this.price;
            } else {
                return currentPrice <= this.price;
            }
        
        case 'stopLoss':
            if (!this.purchasePrice || !this.stopLossPercentage) return false;
            const stopLossPrice = this.purchasePrice * (1 - this.stopLossPercentage / 100);
            return currentPrice <= stopLossPrice;
            
        case 'takeProfit':
            if (!this.purchasePrice || !this.takeProfitPercentage) return false;
            const takeProfitPrice = this.purchasePrice * (1 + this.takeProfitPercentage / 100);
            return currentPrice >= takeProfitPrice;
            
        default:
            return false;
    }
};

// Method to get alert message
alertSchema.methods.getAlertMessage = function() {
    const symbol = this.symbol;
    const currentPrice = this.currentPrice.toFixed(2);
    
    switch (this.alertType) {
        case 'price':
            return `Price Alert: ${symbol} has reached $${currentPrice} (${this.condition} $${this.price})`;
            
        case 'stopLoss':
            const stopLossPrice = (this.purchasePrice * (1 - this.stopLossPercentage / 100)).toFixed(2);
            return `Stop Loss Alert: ${symbol} has reached stop loss price of $${stopLossPrice} (${this.stopLossPercentage}% below purchase price of $${this.purchasePrice})`;
            
        case 'takeProfit':
            const takeProfitPrice = (this.purchasePrice * (1 + this.takeProfitPercentage / 100)).toFixed(2);
            return `Take Profit Alert: ${symbol} has reached target price of $${takeProfitPrice} (${this.takeProfitPercentage}% above purchase price of $${this.purchasePrice})`;
            
        default:
            return `Price Alert: ${symbol} has reached $${currentPrice}`;
    }
};

// Method to trigger alert
alertSchema.methods.trigger = function() {
    this.status = 'triggered';
    this.triggerDate = new Date();
    return this.save();
};

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
