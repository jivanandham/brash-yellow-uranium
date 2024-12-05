const validateTrade = (req, res, next) => {
    if (!req.oidc.isAuthenticated()) {
      return res.status(401).send('Unauthorized: Please login.');
    }
  
    next();
  };
  
  module.exports = { validateTrade };
  