const User = require('../models/User');
const Holding = require('../models/Holding');
const stockPriceService = require('../services/stockPriceService');

const portfolioSummary = async (req, res, next) => {
    try {
        if (req.oidc && req.oidc.isAuthenticated()) {
            const user = await User.findOne({ auth0Id: req.oidc.user.sub });
            if (user) {
                // Get user's holdings
                const holdings = await Holding.find({ userId: user._id });

                // Get current prices for all holdings
                const holdingsWithCurrentPrice = await Promise.all(
                    holdings.map(async (holding) => {
                        const quote = await stockPriceService.getQuote(holding.symbol);
                        const currentPrice = quote ? quote.price : holding.averagePrice;
                        const marketValue = currentPrice * holding.quantity;
                        const profitLoss = marketValue - (holding.averagePrice * holding.quantity);
                        return { marketValue, profitLoss };
                    })
                );

                // Calculate portfolio summary
                const portfolioSummary = holdingsWithCurrentPrice.reduce((summary, holding) => {
                    summary.totalMarketValue += holding.marketValue;
                    summary.totalProfitLoss += holding.profitLoss;
                    return summary;
                }, { totalMarketValue: 0, totalProfitLoss: 0 });

                // Calculate total portfolio value (including cash)
                portfolioSummary.totalValue = portfolioSummary.totalMarketValue + user.walletBalance;

                // Attach to response locals for use in views
                res.locals.portfolioSummary = portfolioSummary;
            }
        }
        next();
    } catch (error) {
        console.error('Error in portfolio summary middleware:', error);
        next();
    }
};

module.exports = portfolioSummary;
