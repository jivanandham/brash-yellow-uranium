const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
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
    type: {
        type: String,
        enum: ['buy', 'sell'],
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    total: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled', 'failed'],
        default: 'pending'
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    executedDate: {
        type: Date
    },
    profitLoss: {
        type: Number,
        default: 0
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Calculate total before saving
orderSchema.pre('save', function(next) {
    this.total = this.price * this.quantity;
    next();
});

// Instance method to cancel order
orderSchema.methods.cancelOrder = function() {
    if (this.status === 'pending') {
        this.status = 'cancelled';
        return true;
    }
    return false;
};

// Instance method to execute order
orderSchema.methods.executeOrder = function() {
    if (this.status === 'pending') {
        this.status = 'completed';
        this.executedDate = new Date();
        return true;
    }
    return false;
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
