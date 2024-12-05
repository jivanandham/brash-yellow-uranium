const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    name: {
        type: String,
        required: true
    },
    currentPrice: {
        type: Number,
        required: true,
        min: 0
    },
    previousPrice: {
        type: Number,
        required: true,
        min: 0
    },
    priceChange: {
        type: Number,
        required: true
    },
    changePercent: {
        type: Number,
        required: true
    },
    volume: {
        type: Number,
        required: true,
        min: 0
    },
    lastUpdated: {
        type: Date,
        required: true,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster lookups
stockSchema.index({ symbol: 1 });

// Method to check if price needs update
stockSchema.methods.needsPriceUpdate = function() {
    if (!this.lastUpdated) return true;
    return Date.now() - this.lastUpdated.getTime() >= 60000; // 1 minute
};

const Stock = mongoose.model('Stock', stockSchema);

module.exports = Stock;
