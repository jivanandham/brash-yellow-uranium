const axios = require('axios');
const User = require('../models/User');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

// Get real-time stock price
exports.getStockPrice = async (req, res) => {
    try {
        const { symbol } = req.query;
        
        if (!symbol) {
            return res.status(400).json({ 
                success: false,
                message: 'Stock symbol is required' 
            });
        }

        const response = await axios.get(`https://www.alphavantage.co/query`, {
            params: {
                function: 'GLOBAL_QUOTE',
                symbol: symbol,
                apikey: process.env.TRADING_API_KEY
            }
        });

        const data = response.data;
        if (data['Global Quote'] && data['Global Quote']['05. price']) {
            const price = parseFloat(data['Global Quote']['05. price']);
            res.json({ 
                success: true,
                price 
            });
        } else {
            res.status(404).json({ 
                success: false,
                message: 'Stock price not found' 
            });
        }
    } catch (error) {
        console.error('Error fetching stock price:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching stock price' 
        });
    }
};

// Execute trade (buy/sell)
exports.executeTrade = async (req, res) => {
    try {
        console.log('Received trade request:', req.body);
        
        const { type, symbol, quantity, price } = req.body;
        const userEmail = req.oidc.user.email;

        // Validate input
        if (!type || !symbol || !quantity || !price) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        if (quantity <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Quantity must be greater than 0'
            });
        }

        if (price <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Price must be greater than 0'
            });
        }

        // Get user
        const user = await User.findOne({ email: userEmail });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const totalValue = quantity * price;

        // Check if buy
        if (type === 'buy') {
            // Check wallet balance
            if (user.walletBalance < totalValue) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient funds'
                });
            }

            // Update wallet balance
            user.walletBalance -= totalValue;
            
            console.log('Buy trade - Updated wallet balance:', user.walletBalance);
        } else if (type === 'sell') {
            // Get current holdings
            const orders = await Order.find({ 
                userId: userEmail,
                symbol: symbol,
                status: 'completed'
            });

            // Calculate total quantity owned
            let totalOwned = 0;
            orders.forEach(order => {
                if (order.type === 'buy') {
                    totalOwned += order.quantity;
                } else {
                    totalOwned -= order.quantity;
                }
            });

            console.log('Sell trade - Current holdings:', { symbol, totalOwned, quantityToSell: quantity });

            // Check if user has enough shares to sell
            if (totalOwned < quantity) {
                return res.status(400).json({
                    success: false,
                    message: 'Insufficient shares'
                });
            }

            // Update wallet balance
            user.walletBalance += totalValue;
            
            console.log('Sell trade - Updated wallet balance:', user.walletBalance);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid trade type'
            });
        }

        // Create order
        const order = new Order({
            userId: userEmail,
            symbol,
            type,
            quantity,
            price,
            total: totalValue,
            status: 'completed',
            orderDate: new Date()
        });

        // Create transaction
        const transaction = new Transaction({
            userEmail,
            type: 'trade',
            amount: type === 'buy' ? -totalValue : totalValue,
            balance: user.walletBalance,
            description: `${type === 'buy' ? 'Bought' : 'Sold'} ${quantity} shares of ${symbol}`,
            stockSymbol: symbol,
            tradeType: type,
            date: new Date()
        });

        console.log('Saving trade records:', {
            order: order.toObject(),
            transaction: transaction.toObject()
        });

        // Save everything
        await Promise.all([
            user.save(),
            order.save(),
            transaction.save()
        ]);

        res.json({
            success: true,
            message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${quantity} shares of ${symbol}`,
            newBalance: user.walletBalance,
            order: {
                symbol,
                quantity,
                price,
                total: totalValue
            }
        });
    } catch (error) {
        console.error('Error executing trade:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error executing trade'
        });
    }
};
