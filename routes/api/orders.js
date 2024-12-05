const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const Order = require('../../models/Order');
const User = require('../../models/User');
const Holding = require('../../models/Holding');
const stockPriceService = require('../../services/stockPriceService');

router.use(requiresAuth());

// Create a new order
router.post('/', async (req, res) => {
    try {
        const { symbol, quantity, type } = req.body;
        const auth0Id = req.oidc.user.sub;

        // Validate input
        if (!symbol || !quantity || !type) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (quantity <= 0) {
            return res.status(400).json({ message: 'Quantity must be greater than 0' });
        }

        // Get current stock price
        const quote = await stockPriceService.getQuote(symbol);
        if (!quote) {
            return res.status(404).json({ message: 'Stock not found' });
        }

        const totalAmount = quantity * quote.price;

        // Get user's wallet balance
        const user = await User.findOne({ auth0Id });
        if (!user) {
            return res.status(404).json({ message: 'User not found. Please try logging out and back in.' });
        }

        if (type === 'buy') {
            // Check if user has enough balance
            if (user.walletBalance < totalAmount) {
                return res.status(400).json({ 
                    message: 'Insufficient funds. Please add more funds to your wallet.' 
                });
            }

            // Create buy order
            const order = new Order({
                userId: user._id,
                symbol,
                companyName: quote.name,
                type: 'buy',
                quantity,
                price: quote.price,
                total: totalAmount,
                status: 'completed'
            });

            // Update or create holding
            let holding = await Holding.findOne({ userId: user._id, symbol });
            
            if (holding) {
                // Update existing holding
                const totalShares = holding.quantity + quantity;
                const totalCost = (holding.quantity * holding.averagePrice) + totalAmount;
                holding.quantity = totalShares;
                holding.averagePrice = totalCost / totalShares;
                holding.lastUpdated = new Date();
            } else {
                // Create new holding
                holding = new Holding({
                    userId: user._id,
                    symbol,
                    companyName: quote.name,
                    quantity,
                    averagePrice: quote.price,
                });
            }

            // Update user's wallet balance
            user.walletBalance -= totalAmount;

            // Save everything
            await Promise.all([
                order.save(),
                holding.save(),
                user.save()
            ]);

            res.status(201).json({ 
                message: 'Stock purchased successfully',
                order,
                holding
            });
        } else if (type === 'sell') {
            // Get user's holding for this stock
            const holding = await Holding.findOne({ userId: user._id, symbol });
            
            if (!holding || holding.quantity < quantity) {
                return res.status(400).json({ 
                    message: 'Insufficient shares to sell.' 
                });
            }

            // Create sell order
            const order = new Order({
                userId: user._id,
                symbol,
                companyName: quote.name,
                type: 'sell',
                quantity,
                price: quote.price,
                total: totalAmount,
                status: 'completed'
            });

            // Update holding
            holding.quantity -= quantity;
            
            // If quantity becomes 0, remove the holding
            if (holding.quantity === 0) {
                await holding.deleteOne();
            } else {
                await holding.save();
            }

            // Update user's wallet balance
            user.walletBalance += totalAmount;

            // Save changes
            await Promise.all([
                order.save(),
                user.save()
            ]);

            res.status(201).json({ 
                message: 'Stock sold successfully',
                order
            });
        } else {
            res.status(400).json({ message: 'Invalid order type' });
        }
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get user's orders
router.get('/', async (req, res) => {
    try {
        const user = await User.findOne({ auth0Id: req.oidc.user.sub });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const orders = await Order.find({ userId: user._id })
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
