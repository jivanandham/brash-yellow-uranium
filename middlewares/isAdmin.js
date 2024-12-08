const User = require('../models/User');

const isAdmin = async (req, res, next) => {
  try {
    if (!req.oidc || !req.oidc.isAuthenticated()) {
      return res.redirect('/login');
    }

    const user = await User.findOne({ email: req.oidc.user.email });
    
    if (!user) {
      return res.status(403).render('403', {
        user: req.oidc.user,
        message: 'User not found in database'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).render('403', {
        user: req.oidc.user,
        message: 'Access Denied: Admins Only'
      });
    }

    // User is an admin, proceed
    next();
  } catch (error) {
    console.error('Error in isAdmin middleware:', error);
    res.status(500).render('error', {
      user: req.oidc ? req.oidc.user : null,
      error: 'Internal Server Error'
    });
  }
};

module.exports = isAdmin;
