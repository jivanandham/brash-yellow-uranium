const Order = require('../models/Order');
const stockPriceService = require('./stockPriceService');

class HoldingsService {
    async getUserHoldings(userId) {
        try {
            // Get all completed orders for the user
            const orders = await Order.find({ 
                userId: userId,
                status: 'completed'
            }).sort({ createdAt: 1 });

            // Process orders to calculate holdings
            const holdingsMap = new Map();

            for (const order of orders) {
                const quote = await stockPriceService.getQuote(order.symbol);
                
                if (!holdingsMap.has(order.symbol)) {
                    holdingsMap.set(order.symbol, {
                        symbol: order.symbol,
                        companyName: order.companyName,
                        quantity: 0,
                        avgPrice: 0,
                        totalInvestment: 0,
                        currentPrice: quote.price,
                        previousClose: quote.previousClose || quote.price,
                        currentValue: 0,
                        profitLoss: 0,
                        profitLossPercent: 0,
                        todayPL: 0,
                        todayPLPercent: 0
                    });
                }

                const holding = holdingsMap.get(order.symbol);

                if (order.type === 'buy') {
                    // Update average price and total investment for buys
                    const newTotalQuantity = holding.quantity + order.quantity;
                    const newTotalInvestment = holding.totalInvestment + (order.quantity * order.price);
                    holding.avgPrice = newTotalInvestment / newTotalQuantity;
                    holding.quantity = newTotalQuantity;
                    holding.totalInvestment = newTotalInvestment;
                } else if (order.type === 'sell') {
                    // Reduce quantity for sells
                    holding.quantity -= order.quantity;
                    holding.totalInvestment = holding.avgPrice * holding.quantity;
                }

                // Remove holding if quantity becomes 0
                if (holding.quantity <= 0) {
                    holdingsMap.delete(order.symbol);
                    continue;
                }

                // Calculate current value and P/L
                holding.currentValue = holding.quantity * quote.price;
                holding.profitLoss = holding.currentValue - holding.totalInvestment;
                holding.profitLossPercent = (holding.profitLoss / holding.totalInvestment) * 100;

                // Calculate today's P/L
                holding.todayPL = holding.quantity * (quote.price - holding.previousClose);
                holding.todayPLPercent = ((quote.price - holding.previousClose) / holding.previousClose) * 100;
            }

            // Calculate portfolio totals
            const holdings = Array.from(holdingsMap.values());
            const totals = holdings.reduce((acc, holding) => {
                acc.totalInvestment += holding.totalInvestment;
                acc.totalCurrentValue += holding.currentValue;
                acc.totalProfitLoss += holding.profitLoss;
                acc.todayPL += holding.todayPL;
                return acc;
            }, {
                totalInvestment: 0,
                totalCurrentValue: 0,
                totalProfitLoss: 0,
                todayPL: 0
            });

            // Calculate percentages
            totals.totalProfitLossPercent = totals.totalInvestment > 0 
                ? (totals.totalProfitLoss / totals.totalInvestment) * 100 
                : 0;
            
            totals.todayPLPercent = totals.totalCurrentValue > 0
                ? (totals.todayPL / (totals.totalCurrentValue - totals.todayPL)) * 100
                : 0;

            return {
                holdings,
                totals
            };
        } catch (error) {
            console.error('Error getting user holdings:', error);
            throw error;
        }
    }
}

module.exports = new HoldingsService();
