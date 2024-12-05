exports.login = (req, res) => res.oidc.login();
exports.logout = (req, res) => res.oidc.logout({ returnTo: process.env.BASE_URL });
exports.getLandingPage = (req, res) => res.render('landing', { user: req.oidc.user });
