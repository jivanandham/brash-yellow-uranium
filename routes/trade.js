const express = require('express');
const router = express.Router();
const { requiresAuth } = require('express-openid-connect');
const { getStockPrice, executeTrade } = require('../controllers/tradeController');
const ensureUser = require('../middlewares/ensureUser');

// Get real-time stock price
router.get('/price', requiresAuth(), ensureUser, getStockPrice);

// Execute trade (buy/sell)
router.post('/execute', requiresAuth(), ensureUser, executeTrade);

// Add more routes here (e.g., buying/selling stocks)

module.exports = router;
