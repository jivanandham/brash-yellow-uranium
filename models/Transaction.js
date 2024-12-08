const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userEmail: { 
        type: String, 
        required: true 
    },
    userId: {
        type: String,  // Changed from ObjectId to String to support Auth0 IDs
        required: true
    },
    type: { 
        type: String, 
        enum: ['deposit', 'withdraw', 'stock_buy', 'stock_sell'], 
        required: true 
    },
    amount: { 
        type: Number, 
        required: true 
    },
    balance: { 
        type: Number, 
        required: true  // Balance after transaction
    },
    description: { 
        type: String, 
        required: true 
    },
    withdrawalMethod: {
        type: String,
        enum: ['bank_transfer', 'paypal', 'crypto'],
        required: function() {
            return this.type === 'withdraw';
        }
    },
    stockSymbol: { 
        type: String,
        required: function() { 
            return this.type === 'stock_buy' || this.type === 'stock_sell';
        }
    },
    quantity: {
        type: Number,
        required: function() {
            return this.type === 'stock_buy' || this.type === 'stock_sell';
        },
        min: 0
    },
    price: {
        type: Number,
        required: function() {
            return this.type === 'stock_buy' || this.type === 'stock_sell';
        },
        min: 0
    },
    total: {
        type: Number,
        required: function() {
            return this.type === 'stock_buy' || this.type === 'stock_sell';
        }
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    date: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

// Calculate total value before saving
transactionSchema.pre('save', function(next) {
    if (this.type === 'stock_buy' || this.type === 'stock_sell') {
        this.total = this.quantity * this.price;
    }
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
