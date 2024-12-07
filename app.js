require('dotenv').config();
const express = require('express');
const { auth, requiresAuth } = require('express-openid-connect');
const mongoose = require('mongoose');
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const helmet = require('helmet');
const path = require('path');
const multer = require('multer');
const session = require('express-session');
const app = express();
const connectDB = require('./config/db');
const authConfig = require('./config/authConfig');
const helmetConfig = require('./config/helmetConfig');
const sessionConfig = require('./config/sessionConfig');

// Import Routes
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const walletRoutes = require('./routes/walletRoutes');
const watchlistRoutes = require('./routes/watchlistRoutes');
const orderRoutes = require('./routes/orderRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const apiRoutes = require('./routes/apiRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const blogRoutes = require('./routes/blogRoutes');
const tradeRoutes = require('./routes/trade');
const stockRoutes = require('./routes/stockRoutes');
const errorHandler = require('./middlewares/errorHandler');
const watchlistApiRoutes = require('./routes/api/watchlist');
const ordersApiRoutes = require('./routes/api/orders');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Middleware for parsing form data

// MongoDB Connection
connectDB();

// Auth0 Configuration
app.use(auth(authConfig));

app.use(helmetConfig);

// session middleware
app.use(sessionConfig);

// Custom flash middleware
app.use((req, res, next) => {
  if (!req.session.flash) {
    req.session.flash = {};
  }

  req.flash = function(type, message) {
    if (req.session.flash[type] === undefined) {
      req.session.flash[type] = [];
    }
    req.session.flash[type].push(message);
  };

  res.locals.messages = req.session.flash;
  req.session.flash = {};
  next();
});

// Middleware to create/update user in database after Auth0 authentication
app.use(async (req, res, next) => {
  try {
    if (req.oidc && req.oidc.isAuthenticated() && req.oidc.user) {
      // Try to find existing user
      let user = await User.findOne({ email: req.oidc.user.email });
      
      if (!user) {
        // Create new user if doesn't exist
        user = await User.create({
          name: req.oidc.user.name,
          email: req.oidc.user.email,
          picture: req.oidc.user.picture,
          role: 'user', // Default role
          walletBalance: 0 // Initialize wallet balance
        });
        console.log('Created new user:', user);
      }
      
      // Attach user to request object
      req.user = user;
    }
    next();
  } catch (error) {
    console.error('Error in user middleware:', error);
    next(error);
  }
});

app.use((req, res, next) => {
  res.locals.user = req.user || null; // Assuming req.user contains the authenticated user
  next();
});

app.post('/csp-violation', express.json(), (req, res) => {
  console.error('CSP Violation:', req.body);
  res.status(204).end();
});

// Import ErrorLog model
const ErrorLog = require('./models/ErrorLog');

// Routes
app.use('/', publicRoutes);
app.use('/dashboard', requiresAuth(), dashboardRoutes);
app.use('/profile', requiresAuth(), profileRoutes);
app.use('/admin', requiresAuth(), adminRoutes);
app.use('/wallet', requiresAuth(), walletRoutes);
app.use('/watchlist', requiresAuth(), watchlistRoutes);
app.use('/orders', requiresAuth(), orderRoutes);
app.use('/notifications', requiresAuth(), notificationRoutes);
app.use('/api', apiRoutes);
app.use('/api/watchlist', watchlistApiRoutes);
app.use('/api/orders', requiresAuth(), ordersApiRoutes);
app.use('/portfolio', requiresAuth(), portfolioRoutes);
app.use('/blog', blogRoutes);
app.use('/trade', requiresAuth(), tradeRoutes);
app.use('/stock', requiresAuth(), stockRoutes);

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', {
        user: req.oidc && req.oidc.user,
        isAuthenticated: req.oidc ? req.oidc.isAuthenticated() : false
    });
});

// Error handling middleware
app.use(async (err, req, res, next) => {
  console.error('Error:', err);

  try {
    // Create error log entry
    const errorLog = new ErrorLog({
      userId: req.oidc?.user ? await User.findOne({ email: req.oidc.user.email })._id : null,
      error: err.message,
      stack: err.stack,
      url: req.originalUrl
    });

    await errorLog.save();
  } catch (logError) {
    console.error('Error saving to error log:', logError);
  }

  // Send response to client
  res.status(500).render('error', {
    message: 'An error occurred',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

app.get('/test-error', (req, res) => {
  throw new Error('Test error for logging');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));