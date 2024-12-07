const Order = require('../models/Order');
const stockPriceService = require('./stockPriceService');

// Centralized function to calculate portfolio metrics
async function calculatePortfolioMetrics(userId) {
    const orders = await Order.find({ userId, status: 'completed' });
    const symbols = [...new Set(orders.map(order => order.symbol))];
    const quotes = await stockPriceService.getBatchQuotes(symbols);
    
    // Calculate holdings
    const holdingsMap = new Map();
    
    // Process all orders chronologically
    orders.sort((a, b) => a.createdAt - b.createdAt).forEach(order => {
        const quote = quotes[order.symbol];
        if (!quote) return;

        let holding = holdingsMap.get(order.symbol) || {
            symbol: order.symbol,
            companyName: order.companyName,
            quantity: 0,
            avgPrice: 0,
            totalInvestment: 0,
            currentPrice: quote.price,
            currentValue: 0,
            profitLoss: 0,
            profitLossPercent: 0,
            priceChange: quote.change,
            lastUpdated: new Date()
        };

        if (order.type === 'buy') {
            // Update holding for buy orders
            const newQuantity = holding.quantity + order.quantity;
            const newInvestment = holding.totalInvestment + (order.quantity * order.price);
            
            holding.quantity = newQuantity;
            holding.totalInvestment = newInvestment;
            holding.avgPrice = newInvestment / newQuantity;
        } else if (order.type === 'sell') {
            // Update holding for sell orders
            const newQuantity = holding.quantity - order.quantity;
            // Calculate the portion of investment being sold
            const soldInvestment = (order.quantity / holding.quantity) * holding.totalInvestment;
            holding.totalInvestment -= soldInvestment;
            holding.quantity = newQuantity;
            
            if (newQuantity > 0) {
                holding.avgPrice = holding.totalInvestment / newQuantity;
            } else {
                // If all shares are sold, remove from holdings
                holdingsMap.delete(order.symbol);
                return;
            }
        }

        // Update current values
        holding.currentValue = holding.quantity * quote.price;
        holding.profitLoss = holding.currentValue - holding.totalInvestment;
        holding.profitLossPercent = (holding.profitLoss / holding.totalInvestment) * 100;

        // Only keep holdings with positive quantities
        if (holding.quantity > 0) {
            holdingsMap.set(order.symbol, holding);
        } else {
            holdingsMap.delete(order.symbol);
        }
    });

    const holdings = Array.from(holdingsMap.values());

    // Calculate portfolio totals
    const totals = holdings.reduce((acc, holding) => {
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

    return {
        totalInvestment: totals.totalInvestment,
        totalCurrentValue: totals.totalCurrentValue,
        totalProfitLoss: totals.totalProfitLoss,
        totalProfitLossPercent: totals.totalProfitLossPercent,
        holdings,
        lastUpdated: new Date()
    };
}

module.exports = {
    calculatePortfolioMetrics
};
