const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
    userId: {
        type: String,  // Auth0 ID
        required: true,
        index: true
    },
    userEmail: {
        type: String,
        required: true
    },
    symbol: {
        type: String,
        required: true
    },
    companyName: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    averagePrice: {
        type: Number,
        required: true,
        default: 0
    },
    totalInvestment: {
        type: Number,
        required: true,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure a user can't have duplicate holdings for the same stock
holdingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

// Pre-save middleware to update lastUpdated
holdingSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

// Method to calculate current value
holdingSchema.methods.getCurrentValue = function() {
    return this.quantity * this.averagePrice;
};

// Method to calculate profit/loss
holdingSchema.methods.getProfitLoss = function(currentPrice) {
    const currentValue = this.quantity * currentPrice;
    const investmentValue = this.quantity * this.averagePrice;
    return currentValue - investmentValue;
};

module.exports = mongoose.model('Holding', holdingSchema);
