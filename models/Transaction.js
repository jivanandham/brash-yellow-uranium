const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userEmail: { 
        type: String, 
        required: true 
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: { 
        type: String, 
        enum: ['deposit', 'withdraw', 'buy', 'sell'], 
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
    stockSymbol: { 
        type: String,
        required: function() { 
            return this.type === 'buy' || this.type === 'sell';
        }
    },
    quantity: {
        type: Number,
        required: function() {
            return this.type === 'buy' || this.type === 'sell';
        },
        min: 0
    },
    price: {
        type: Number,
        required: function() {
            return this.type === 'buy' || this.type === 'sell';
        },
        min: 0
    },
    total: {
        type: Number,
        required: function() {
            return this.type === 'buy' || this.type === 'sell';
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
    if (this.type === 'buy' || this.type === 'sell') {
        this.total = this.quantity * this.price;
    }
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
