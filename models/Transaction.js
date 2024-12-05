const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  type: { type: String, enum: ['deposit', 'withdraw', 'trade'], required: true },
  amount: { type: Number, required: true },
  balance: { type: Number, required: true }, // Balance after transaction
  description: { type: String, required: true },
  stockSymbol: { type: String }, // For trade transactions
  tradeType: { type: String, enum: ['buy', 'sell'] }, // For trade transactions
  date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', transactionSchema);
