const Order = require('../models/Order');
const Holding = require('../models/Holding');
const stockPriceService = require('./stockPriceService');

// Centralized function to calculate portfolio metrics
async function calculatePortfolioMetrics(userEmail) {
    try {
        console.log('Calculating portfolio metrics for user:', userEmail);

        // Get all holdings for the user - query by userEmail instead of userId
        const holdings = await Holding.find({ userEmail });
        console.log('Found holdings:', holdings);
        
        if (!holdings || holdings.length === 0) {
            console.log('No holdings found for user');
            return {
                totalInvestment: 0,
                totalCurrentValue: 0,
                totalProfitLoss: 0,
                totalProfitLossPercent: 0,
                holdings: [],
                lastUpdated: new Date()
            };
        }

        // Get current prices for all symbols
        const symbols = [...new Set(holdings.map(h => h.symbol))];
        console.log('Fetching quotes for symbols:', symbols);
        const quotes = await stockPriceService.getBatchQuotes(symbols);
        console.log('Received quotes:', quotes);
        
        // Update holdings with current prices and calculate metrics
        const updatedHoldings = holdings.map(holding => {
            const quote = quotes[holding.symbol] || { 
                price: holding.averagePrice,
                change: 0,
                changePercent: 0
            };
            const currentPrice = quote.price;
            const currentValue = holding.quantity * currentPrice;
            const profitLoss = currentValue - holding.totalInvestment;
            const profitLossPercent = (profitLoss / holding.totalInvestment) * 100;

            const updatedHolding = {
                ...holding.toObject(),
                currentPrice,
                currentValue,
                profitLoss,
                profitLossPercent,
                avgPrice: holding.averagePrice, 
                priceChange: quote.change || 0, 
                changePercent: quote.changePercent || 0 
            };
            console.log('Updated holding:', updatedHolding);
            return updatedHolding;
        });

        // Calculate portfolio totals
        const totals = updatedHoldings.reduce((acc, holding) => {
            acc.totalInvestment += holding.totalInvestment;
            acc.totalCurrentValue += holding.currentValue;
            acc.totalProfitLoss += holding.profitLoss;
            return acc;
        }, {
            totalInvestment: 0,
            totalCurrentValue: 0,
            totalProfitLoss: 0
        });

        totals.totalProfitLossPercent = totals.totalInvestment > 0 
            ? (totals.totalProfitLoss / totals.totalInvestment) * 100 
            : 0;

        console.log('Portfolio totals:', totals);

        const result = {
            ...totals,
            holdings: updatedHoldings,
            lastUpdated: new Date()
        };
        console.log('Final portfolio metrics:', result);
        return result;
    } catch (error) {
        console.error('Error calculating portfolio metrics:', error);
        throw error;
    }
}

module.exports = {
    calculatePortfolioMetrics
};
