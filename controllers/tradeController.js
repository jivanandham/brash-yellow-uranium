const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const Holding = require('../models/Holding');
const stockPriceService = require('../services/stockPriceService');

// Function to update user holdings after a trade
async function updateHoldings(userId, userEmail, symbol, companyName, type, quantity, price) {
    try {
        let holding = await Holding.findOne({ userEmail, symbol });
        
        if (!holding) {
            // Create new holding if it doesn't exist
            holding = new Holding({
                userEmail,
                symbol,
                companyName,
                quantity: 0,
                averagePrice: 0,
                totalInvestment: 0
            });
        } else {
            // Update userEmail for existing holding to ensure it's always present
            holding.userEmail = userEmail;
        }

        if (type === 'buy') {
            // For buy orders:
            // 1. Add new investment amount to total investment
            // 2. Add new quantity to total quantity
            // 3. Calculate new average price based on total investment and total quantity
            const newInvestment = quantity * price;
            const newQuantity = holding.quantity + quantity;
            const totalInvestment = holding.totalInvestment + newInvestment;
            
            holding.quantity = newQuantity;
            holding.totalInvestment = totalInvestment;
            holding.averagePrice = totalInvestment / newQuantity;
            
            console.log('Updated holding after buy:', {
                symbol,
                oldQuantity: holding.quantity - quantity,
                newQuantity: holding.quantity,
                oldAvgPrice: holding.averagePrice,
                newAvgPrice: totalInvestment / newQuantity,
                totalInvestment
            });
        } else if (type === 'sell') {
            // For sell orders:
            // 1. Reduce quantity
            // 2. Reduce total investment proportionally
            // 3. Keep the same average price
            const newQuantity = holding.quantity - quantity;
            if (newQuantity < 0) {
                throw new Error('Insufficient shares to sell');
            }
            
            // Calculate the portion of investment being sold
            const soldInvestment = (quantity / holding.quantity) * holding.totalInvestment;
            const remainingInvestment = holding.totalInvestment - soldInvestment;
            
            holding.quantity = newQuantity;
            holding.totalInvestment = remainingInvestment;
            // Keep the same average price for remaining shares
            
            console.log('Updated holding after sell:', {
                symbol,
                oldQuantity: holding.quantity + quantity,
                newQuantity: holding.quantity,
                avgPrice: holding.averagePrice,
                remainingInvestment
            });
        }

        // If quantity becomes 0, remove the holding
        if (holding.quantity === 0) {
            await Holding.deleteOne({ userEmail, symbol });
            console.log(`Removed holding for ${symbol} as quantity is 0`);
        } else {
            holding.lastUpdated = new Date();
            await holding.save();
            console.log(`Saved holding for ${symbol}:`, holding.toObject());
        }
    } catch (error) {
        console.error('Error updating holdings:', error);
        throw error;
    }
}

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

        const [quote, company] = await Promise.all([
            stockPriceService.getQuote(symbol),
            stockPriceService.getCompanyProfile(symbol)
        ]);
        
        if (quote && quote.price) {
            res.json({ 
                success: true,
                price: quote.price,
                companyName: company.name
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
        
        const { type, symbol, companyName, quantity, price } = req.body;
        const userEmail = req.oidc.user.email;
        const userId = req.oidc.user.sub;  // Auth0 ID

        // Validate input
        if (!type || !symbol || !companyName || !quantity || !price) {
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

        // Get or create user
        let user = await User.findOne({ email: userEmail });
        if (!user) {
            // Create new user if not exists
            user = new User({
                _id: userId,  // Use Auth0 ID as MongoDB _id
                email: userEmail,
                name: req.oidc.user.name || userEmail.split('@')[0],
                picture: req.oidc.user.picture,
                role: 'user'
            });
            await user.save();
            console.log('Created new user:', user);
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
            // Get current holdings using user's email
            const holding = await Holding.findOne({ 
                userEmail: userEmail,
                symbol: symbol
            });

            // Check if user has enough shares to sell
            if (!holding || holding.quantity < quantity) {
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
            userId: userId,  // Include Auth0 ID
            userEmail: userEmail,
            symbol,
            companyName,
            type,
            quantity,
            price,
            total: totalValue,
            status: 'completed',
            orderDate: new Date()
        });

        // Create transaction
        const transaction = new Transaction({
            userId: userId,  // Include Auth0 ID
            userEmail: userEmail,
            type: 'stock_' + type,
            amount: type === 'buy' ? -totalValue : totalValue,
            balance: user.walletBalance,
            description: `${type === 'buy' ? 'Stock Purchase' : 'Stock Sale'}: ${quantity} shares of ${companyName} (${symbol}) at $${price.toFixed(2)} per share`,
            stockSymbol: symbol,
            quantity,
            price,
            total: totalValue,
            status: 'completed',
            date: new Date()
        });

        try {
            // Save everything and update holdings
            const [savedUser, savedOrder, savedTransaction] = await Promise.all([
                user.save(),
                order.save(),
                transaction.save()
            ]);

            // Update holdings after saving order and transaction
            await updateHoldings(userEmail, userEmail, symbol, companyName, type, quantity, price);

            console.log('Successfully saved all trade records and updated holdings');

            res.json({
                success: true,
                message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${quantity} shares of ${symbol}`,
                newBalance: savedUser.walletBalance,
                order: {
                    id: savedOrder._id,
                    symbol,
                    companyName,
                    quantity,
                    price,
                    total: totalValue,
                    type,
                    date: savedOrder.orderDate
                },
                transaction: {
                    id: savedTransaction._id,
                    type: savedTransaction.type,
                    amount: savedTransaction.amount,
                    balance: savedTransaction.balance,
                    description: savedTransaction.description,
                    date: savedTransaction.date
                }
            });
        } catch (error) {
            console.error('Error executing trade:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Error executing trade'
            });
        }
    } catch (error) {
        console.error('Error executing trade:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error executing trade'
        });
    }
};
