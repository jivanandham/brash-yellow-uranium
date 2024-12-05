const express = require('express');
const { auth } = require('express-openid-connect');
const path = require('path');

const app = express();

// Auth0 configuration
const config = {
    authRequired: false,
    auth0Logout: true,
    secret: 'your-secret-key',
    baseURL: 'http://localhost:3000',
    clientID: 'your-client-id',
    issuerBaseURL: 'your-auth0-domain'
};

// Middleware
app.use(auth(config));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Routes
const watchlistRoutes = require('./routes/watchlistRoutes');
const blogRoutes = require('./routes/blogRoutes');

app.use('/watchlist', watchlistRoutes);
app.use('/blog', blogRoutes);

// Home route
app.get('/', (req, res) => {
    res.render('index', {
        user: req.oidc.user,
        isAuthenticated: req.oidc.isAuthenticated()
    });
});

// User dashboard route
app.get('/dashboard', (req, res) => {
    res.render('user-dashboard', {
        user: req.oidc.user,
        isAuthenticated: req.oidc.isAuthenticated()
    });
});

// Trading Guide route
app.get('/trading-guide', (req, res) => {
    res.render('trading-guide', {
        user: req.oidc.user,
        isAuthenticated: req.oidc.isAuthenticated()
    });
});

// Help Center route
app.get('/help-center', (req, res) => {
    res.render('help-center', {
        user: req.oidc.user,
        isAuthenticated: req.oidc.isAuthenticated()
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
