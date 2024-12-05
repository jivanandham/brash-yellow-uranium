const User = require('../models/User'); // Adjust the path to your User model if necessary

const isAdmin = async (req, res, next) => {
      if (!req.oidc.isAuthenticated()) {
        return res.status(401).send('Unauthorized: Please login.');
      }
    
      const user = await User.findOne({ email: req.oidc.user.email });
      if (user && user.role === 'admin') {
        return next();
      }
    
      res.status(403).send('Forbidden: Admins only.');
    };

    module.exports = (req, res, next) => {
      if (req.oidc && req.oidc.user && req.oidc.user.roles && req.oidc.user.roles.includes('admin')) {
        return next(); // User is an admin
      }
      res.status(403).send('Access Denied: Admins Only'); // Restrict access
    };
    

module.exports = isAdmin;
