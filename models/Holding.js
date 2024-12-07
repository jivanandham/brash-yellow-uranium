const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
    userEmail: {
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

// Create a compound index on userEmail and symbol to ensure uniqueness
holdingSchema.index({ userEmail: 1, symbol: 1 }, { unique: true });

// Pre-save middleware to update lastUpdated
holdingSchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

// Method to calculate current value
holdingSchema.methods.getCurrentValue = function(currentPrice) {
    return this.quantity * currentPrice;
};

// Method to calculate profit/loss
holdingSchema.methods.getProfitLoss = function(currentPrice) {
    const currentValue = this.getCurrentValue(currentPrice);
    const investmentValue = this.quantity * this.averagePrice;
    return currentValue - investmentValue;
};

module.exports = mongoose.model('Holding', holdingSchema);
