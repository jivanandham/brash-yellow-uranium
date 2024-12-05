const UserActivity = require('../models/UserActivity');

// Log login activity
router.post('/login', async (req, res, next) => {
  try {
    // Assuming `req.user` is populated after successful authentication
    req.session.userId = req.user._id;

    await UserActivity.create({
      userId: req.user._id,
      activity: 'login',
    });

    res.redirect('/dashboard'); // Adjust as needed
  } catch (err) {
    console.error('Error during login:', err);
    next(err);
  }
});

// Log logout activity
router.post('/logout', async (req, res, next) => {
  try {
    if (req.session.userId) {
      await UserActivity.create({
        userId: req.session.userId,
        activity: 'logout',
      });

      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        res.redirect('/'); // Adjust as needed
      });
    } else {
      res.redirect('/');
    }
  } catch (err) {
    console.error('Error during logout:', err);
    next(err);
  }
});

module.exports = router;