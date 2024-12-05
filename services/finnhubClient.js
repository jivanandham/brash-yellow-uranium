const finnhub = require('finnhub');
require('dotenv').config();

const api_key = finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = process.env.FINNHUB_API_KEY;

const finnhubClient = new finnhub.DefaultApi();

// Wrap Finnhub API calls in promises for easier use
const finnhubWrapper = {
    quote: (symbol) => {
        return new Promise((resolve, reject) => {
            finnhubClient.quote(symbol, (error, data, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(data);
                }
            });
        });
    },

    // Add more methods as needed
    companyProfile: (symbol) => {
        return new Promise((resolve, reject) => {
            finnhubClient.companyProfile2({ 'symbol': symbol }, (error, data, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(data);
                }
            });
        });
    },

    stockCandles: (symbol, resolution = 'D', from, to) => {
        return new Promise((resolve, reject) => {
            finnhubClient.stockCandles(symbol, resolution, from, to, (error, data, response) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(data);
                }
            });
        });
    }
};

module.exports = finnhubWrapper;
