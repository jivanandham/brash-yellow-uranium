const express = require('express');
const router = express.Router();
const { getStockPrice } = require('../controllers/tradeController');

// Get real-time stock price
router.get('/price', getStockPrice);

// Add more routes here (e.g., buying/selling stocks)

module.exports = router;
