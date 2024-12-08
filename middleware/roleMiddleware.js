const User = require('../models/User');

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    if (!req.oidc.isAuthenticated()) {
        return res.redirect('/login');
    }

    try {
        const user = await User.findOne({ email: req.oidc.user.email });
        if (!user) {
            return res.redirect('/login');
        }

        if (user.role !== 'admin') {
            return res.redirect('/dashboard');
        }

        next();
    } catch (error) {
        console.error('Role middleware error:', error);
        res.status(500).render('error', {
            message: 'Error checking user role',
            error,
            isAuthenticated: true
        });
    }
};

// Middleware to check if user is a regular user
const isUser = async (req, res, next) => {
    if (!req.oidc.isAuthenticated()) {
        return res.redirect('/login');
    }

    try {
        const user = await User.findOne({ email: req.oidc.user.email });
        if (!user) {
            return res.redirect('/login');
        }

        if (user.role === 'admin') {
            return res.redirect('/admin');
        }

        next();
    } catch (error) {
        console.error('Role middleware error:', error);
        res.status(500).render('error', {
            message: 'Error checking user role',
            error,
            isAuthenticated: true
        });
    }
};

module.exports = {
    isAdmin,
    isUser
};
