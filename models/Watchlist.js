const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    stocks: [{
        symbol: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        sector: {
            type: String,
            default: 'N/A'
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        lastPrice: {
            type: Number,
            default: 0
        },
        priceChange: {
            type: Number,
            default: 0
        },
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    }],
    settings: {
        notifications: {
            priceAlerts: {
                type: Boolean,
                default: true
            },
            emailUpdates: {
                type: Boolean,
                default: false
            }
        },
        displayPreferences: {
            sortBy: {
                type: String,
                enum: ['symbol', 'name', 'addedAt', 'priceChange'],
                default: 'addedAt'
            },
            order: {
                type: String,
                enum: ['asc', 'desc'],
                default: 'desc'
            }
        }
    }
}, {
    timestamps: true
});

// Index for efficient queries
watchlistSchema.index({ userId: 1, 'stocks.symbol': 1 });

// Method to check if a stock exists in the watchlist
watchlistSchema.methods.hasStock = function(symbol) {
    return this.stocks.some(stock => stock.symbol === symbol);
};

// Method to add a stock
watchlistSchema.methods.addStock = function(stockData) {
    if (!this.hasStock(stockData.symbol)) {
        this.stocks.push(stockData);
    }
    return this;
};

// Method to remove a stock
watchlistSchema.methods.removeStock = function(symbol) {
    this.stocks = this.stocks.filter(stock => stock.symbol !== symbol);
    return this;
};

// Method to update stock price
watchlistSchema.methods.updateStockPrice = function(symbol, price, change) {
    const stock = this.stocks.find(s => s.symbol === symbol);
    if (stock) {
        stock.lastPrice = price;
        stock.priceChange = change;
        stock.lastUpdated = new Date();
    }
    return this;
};

const Watchlist = mongoose.model('Watchlist', watchlistSchema);

module.exports = Watchlist;
