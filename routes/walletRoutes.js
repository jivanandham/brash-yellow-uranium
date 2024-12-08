const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// Display Wallet Details
router.get('/', async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.redirect('/login');
  }

  try {
    const user = await User.findOne({ email: req.oidc.user.email });
    if (!user) {
      return res.redirect('/login');
    }

    // Fetch only 2 most recent transactions
    const transactions = await Transaction.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .limit(2);

    res.render('wallet', { 
      user,
      transactions,
      isAuthenticated: req.oidc.isAuthenticated()
    });
  } catch (err) {
    console.error('Error fetching wallet:', err);
    res.status(500).render('error', { 
      message: 'Error loading wallet details',
      error: err
    });
  }
});

// Add Funds
router.post('/add-funds', async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  try {
    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || amount < 1 || amount > 100000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Please enter an amount between $1 and $100,000.'
      });
    }

    const user = await User.findOne({ email: req.oidc.user.email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Update wallet balance
    const updatedUser = await User.findOneAndUpdate(
      { email: user.email },
      { $inc: { walletBalance: amount } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update wallet balance'
      });
    }

    // Create transaction record
    const transaction = await Transaction.create({
      userEmail: user.email,
      userId: req.oidc.user.sub,
      type: 'deposit',
      amount: amount,
      balance: updatedUser.walletBalance,
      description: 'Added funds to wallet',
      status: 'completed'
    });

    if (!transaction) {
      console.warn('Transaction creation failed');
    }

    res.json({
      success: true,
      newBalance: updatedUser.walletBalance,
      message: `Successfully added $${amount.toFixed(2)} to your wallet`
    });
  } catch (err) {
    console.error('Error adding funds:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to add funds. Please try again.'
    });
  }
});

// Withdraw Funds
router.post('/withdraw-funds', async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }

  try {
    const { amount, method } = req.body;
    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Minimum withdrawal amount is $100'
      });
    }

    if (!['bank_transfer', 'paypal', 'crypto'].includes(method)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid withdrawal method'
      });
    }

    const user = await User.findOne({ email: req.oidc.user.email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.walletBalance < withdrawAmount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient funds in wallet'
      });
    }

    // Update wallet balance
    const updatedUser = await User.findOneAndUpdate(
      { email: user.email },
      { $inc: { walletBalance: -withdrawAmount } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update wallet balance'
      });
    }

    // Create transaction record
    const transaction = await Transaction.create({
      userEmail: user.email,
      userId: user._id,
      type: 'withdraw',
      amount: withdrawAmount,
      balance: updatedUser.walletBalance,
      description: `Withdrawn via ${method.replace('_', ' ')}`,
      withdrawalMethod: method,
      status: 'completed'
    });

    if (!transaction) {
      console.warn('Transaction creation failed');
    }

    res.json({
      success: true,
      newBalance: updatedUser.walletBalance,
      message: `Successfully withdrawn $${withdrawAmount.toFixed(2)} from your wallet`
    });
  } catch (err) {
    console.error('Error withdrawing funds:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to withdraw funds. Please try again.'
    });
  }
});

// Transaction History
router.get('/transaction-history', async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.redirect('/login');
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ email: req.oidc.user.email });
    if (!user) {
      return res.redirect('/login');
    }

    // Get total count for pagination
    const totalTransactions = await Transaction.countDocuments({ userEmail: user.email });
    const totalPages = Math.ceil(totalTransactions / limit);

    // Get transactions for current page
    const transactions = await Transaction.find({ userEmail: user.email })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render('transaction-history', {
      user,
      transactions,
      currentPage: page,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      isAuthenticated: req.oidc.isAuthenticated()
    });
  } catch (err) {
    console.error('Error fetching transaction history:', err);
    res.status(500).render('error', {
      message: 'Error loading transaction history',
      error: err,
      isAuthenticated: req.oidc.isAuthenticated()
    });
  }
});

module.exports = router;
