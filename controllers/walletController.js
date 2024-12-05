const User = require('../models/User');
const Transaction = require('../models/Transaction');

exports.getWallet = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.oidc.user.email });
    res.render('wallet', { user });
  } catch (err) {
    console.error('Error fetching wallet:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.addFunds = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.oidc.user.email });
    const amount = parseFloat(req.body.amount);

    if (isNaN(amount) || amount <= 0) return res.status(400).send('Invalid amount');

    user.walletBalance += amount;
    await user.save();

    const transaction = new Transaction({
      userEmail: req.oidc.user.email,
      type: 'deposit',
      amount,
      description: 'Funds added to wallet',
    });
    await transaction.save();

    res.redirect('/wallet');
  } catch (err) {
    console.error('Error adding funds:', err);
    res.status(500).send('Internal Server Error');
  }
};

exports.withdrawFunds = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.oidc.user.email });
    const amount = parseFloat(req.body.amount);

    if (isNaN(amount) || amount <= 0 || user.walletBalance < amount) {
      return res.status(400).send('Invalid or insufficient funds');
    }

    user.walletBalance -= amount;
    await user.save();

    const transaction = new Transaction({
      userEmail: req.oidc.user.email,
      type: 'withdraw',
      amount,
      description: 'Funds withdrawn from wallet',
    });
    await transaction.save();

    res.redirect('/wallet');
  } catch (err) {
    console.error('Error withdrawing funds:', err);
    res.status(500).send('Internal Server Error');
  }
};
