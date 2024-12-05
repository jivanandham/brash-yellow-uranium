const User = require('../models/User');

const ensureUser = async (req, res, next) => {
    try {
        if (req.oidc && req.oidc.isAuthenticated() && req.oidc.user) {
            // Try to find user by Auth0 ID
            let user = await User.findOne({ _id: req.oidc.user.sub });
            
            if (!user) {
                // Try to find user by email as fallback
                user = await User.findOne({ email: req.oidc.user.email });
                
                if (user) {
                    // Update existing user with Auth0 ID
                    user._id = req.oidc.user.sub;
                    user.name = req.oidc.user.name || req.oidc.user.email.split('@')[0];
                    user.picture = req.oidc.user.picture;
                    await user.save();
                    console.log('Updated existing user with Auth0 ID:', user);
                } else {
                    // Create new user
                    user = new User({
                        _id: req.oidc.user.sub,
                        name: req.oidc.user.name || req.oidc.user.email.split('@')[0],
                        email: req.oidc.user.email,
                        picture: req.oidc.user.picture,
                        role: 'user',
                        walletBalance: 0
                    });
                    await user.save();
                    console.log('Created new user:', user);
                }
            }
            
            // Attach user to request object for later use
            req.user = user;
        }
        next();
    } catch (error) {
        console.error('Error in ensureUser middleware:', error);
        next(error);
    }
};

module.exports = ensureUser;
