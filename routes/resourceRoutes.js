const express = require('express');
const router = express.Router();

// Trading Guide route
router.get('/trading-guide', (req, res) => {
    res.render('resources/trading-guide', {
        user: req.oidc.user,
        isAuthenticated: req.oidc.isAuthenticated()
    });
});

// Market News route
router.get('/market-news', (req, res) => {
    res.render('resources/market-news', {
        user: req.oidc.user,
        isAuthenticated: req.oidc.isAuthenticated()
    });
});

// Help Center route
router.get('/help-center', (req, res) => {
    res.render('resources/help-center', {
        user: req.oidc.user,
        isAuthenticated: req.oidc.isAuthenticated()
    });
});

module.exports = router;
