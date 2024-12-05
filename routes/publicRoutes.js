const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.oidc.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.render('landing', { user: req.oidc.user });
});

router.get('/about', (req, res) => res.render('about'));
router.get('/pricing', (req, res) => res.render('pricing'));
router.get('/features', (req, res) => res.render('features'));
router.get('/contact', (req, res) => res.render('contact'));

module.exports = router;
