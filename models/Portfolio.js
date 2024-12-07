const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    holdings: [{
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
            min: 0
        },
        avgPrice: {
            type: Number,
            required: true,
            min: 0
        },
        currentPrice: {
            type: Number,
            required: true,
            min: 0
        }
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Calculate current value, profit/loss for each holding
portfolioSchema.methods.calculateMetrics = function() {
    this.holdings.forEach(holding => {
        holding.currentValue = holding.quantity * holding.currentPrice;
        holding.profitLoss = holding.currentValue - (holding.quantity * holding.avgPrice);
        holding.profitLossPercent = ((holding.currentPrice - holding.avgPrice) / holding.avgPrice) * 100;
    });
};

// Calculate total portfolio metrics
portfolioSchema.methods.calculateTotalMetrics = function() {
    return {
        totalInvestment: this.holdings.reduce((total, holding) => total + (holding.quantity * holding.avgPrice), 0),
        totalCurrentValue: this.holdings.reduce((total, holding) => total + (holding.quantity * holding.currentPrice), 0),
        totalProfitLoss: this.holdings.reduce((total, holding) => total + (holding.quantity * (holding.currentPrice - holding.avgPrice)), 0)
    };
};

const Portfolio = mongoose.model('Portfolio', portfolioSchema);

module.exports = Portfolio;
