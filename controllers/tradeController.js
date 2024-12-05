const axios = require('axios');

const API_KEY = process.env.TRADING_API_KEY; // Your API key
const BASE_URL = 'https://www.alphavantage.co/query'; // Alpha Vantage base URL

// Get real-time stock prices
const getStockPrice = async (req, res) => {
  try {
    const { symbol } = req.query; // Example: ?symbol=TSLA
    const response = await axios.get(`${BASE_URL}`, {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: symbol,
        apikey: API_KEY,
      },
    });

    const data = response.data['Global Quote'];
    if (!data) {
      return res.status(404).send('Stock data not found.');
    }

    const stockDetails = {
      symbol: data['01. symbol'],
      price: parseFloat(data['05. price']),
      volume: parseInt(data['06. volume'], 10),
    };

    res.json(stockDetails);
  } catch (err) {
    console.error('Error fetching stock price:', err.message);
    res.status(500).send('Failed to fetch stock price.');
  }
};

module.exports = { getStockPrice };
