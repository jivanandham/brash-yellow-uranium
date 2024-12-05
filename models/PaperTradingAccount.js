const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
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
    averagePrice: {
        type: Number,
        required: true,
        min: 0
    },
    currentPrice: {
        type: Number,
        required: true,
        min: 0
    }
});

const paperTradingAccountSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        required: true,
        default: 100000 // Starting with $100,000 paper money
    },
    holdings: [holdingSchema],
    totalProfitLoss: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Method to update holding's current price
paperTradingAccountSchema.methods.updateHoldingPrice = function(symbol, currentPrice) {
    const holding = this.holdings.find(h => h.symbol === symbol);
    if (holding) {
        holding.currentPrice = currentPrice;
    }
};

// Method to calculate total portfolio value
paperTradingAccountSchema.methods.calculatePortfolioValue = function() {
    const holdingsValue = this.holdings.reduce((total, holding) => {
        return total + (holding.quantity * holding.currentPrice);
    }, 0);
    return this.balance + holdingsValue;
};

// Method to execute buy order
paperTradingAccountSchema.methods.executeBuyOrder = function(symbol, companyName, quantity, price) {
    const orderTotal = quantity * price;
    if (orderTotal > this.balance) {
        throw new Error('Insufficient funds');
    }

    const existingHolding = this.holdings.find(h => h.symbol === symbol);
    if (existingHolding) {
        // Update existing holding
        const totalShares = existingHolding.quantity + quantity;
        const totalCost = (existingHolding.quantity * existingHolding.averagePrice) + (quantity * price);
        existingHolding.averagePrice = totalCost / totalShares;
        existingHolding.quantity = totalShares;
        existingHolding.currentPrice = price;
    } else {
        // Create new holding
        this.holdings.push({
            symbol,
            companyName,
            quantity,
            averagePrice: price,
            currentPrice: price
        });
    }

    this.balance -= orderTotal;
    return true;
};

// Method to execute sell order
paperTradingAccountSchema.methods.executeSellOrder = function(symbol, quantity, price) {
    const holding = this.holdings.find(h => h.symbol === symbol);
    if (!holding) {
        throw new Error('No such holding');
    }
    if (holding.quantity < quantity) {
        throw new Error('Insufficient shares');
    }

    const saleTotal = quantity * price;
    const profitLoss = (price - holding.averagePrice) * quantity;
    
    this.balance += saleTotal;
    this.totalProfitLoss += profitLoss;

    holding.quantity -= quantity;
    if (holding.quantity === 0) {
        this.holdings = this.holdings.filter(h => h.symbol !== symbol);
    }

    return {
        success: true,
        profitLoss
    };
};

const PaperTradingAccount = mongoose.model('PaperTradingAccount', paperTradingAccountSchema);

module.exports = PaperTradingAccount;
