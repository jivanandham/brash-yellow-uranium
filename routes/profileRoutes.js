const express = require('express');
const multerConfig = require('../config/multerConfig');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const router = express.Router();

// View Profile
router.get('/', async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.redirect('/login');
  }

  try {
    const user = await User.findOne({ email: req.oidc.user.email });
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Format the last updated date
    const lastUpdated = user.updated_at ? new Date(user.updated_at) : new Date();
    const formattedDate = lastUpdated.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Fetch dashboard stats
    const totalUsers = await User.countDocuments(); // Count all users
    
    const activeAdmins = await User.countDocuments({ 
      role: 'admin'
    });
    
    const totalTransactions = await Transaction.countDocuments();
    
    // Calculate growth rate
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    const growthRate = totalUsers === 0 ? 0 : Math.round((recentUsers / totalUsers) * 100);

    res.render('profile-view', { 
      user: {
        ...user.toObject(),
        formattedLastUpdate: formattedDate
      },
      totalUsers, 
      activeAdmins, 
      totalTransactions, 
      growthRate,
      messages: res.locals.messages || {},
      isAuthenticated: req.oidc.isAuthenticated(),
      isAdmin: user.role === 'admin'
    });
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Edit Profile
router.get('/edit', async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.redirect('/login');
  }

  try {
    const user = await User.findOne({ email: req.oidc.user.email });
    if (!user) {
      return res.status(404).send('User not found');
    }

    res.render('profile-edit', { 
      user,
      messages: res.locals.messages || {},
      isAuthenticated: req.oidc.isAuthenticated(),
      isAdmin: user.role === 'admin'
    });
  } catch (err) {
    console.error('Error fetching profile for edit:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Update Profile
router.post('/edit', async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.redirect('/login');
  }

  try {
    const updateData = {
      name: req.body.name,
      bio: req.body.bio,
      contactNumber: req.body.contactNumber
    };

    // Remove undefined or empty fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined || updateData[key] === '') {
        delete updateData[key];
      }
    });

    const updatedUser = await User.findOneAndUpdate(
      { email: req.oidc.user.email },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).send('User not found');
    }

    req.flash('success', 'Profile updated successfully');
    res.redirect('/profile');
  } catch (err) {
    console.error('Error updating profile:', err);
    req.flash('error', 'Failed to update profile');
    res.redirect('/profile/edit');
  }
});

// Delete Profile
router.post('/delete', async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.redirect('/login');
  }

  try {
    await User.findOneAndDelete({ email: req.oidc.user.email });
    res.redirect('/logout');
  } catch (err) {
    console.error('Error deleting profile:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Profile Photo Upload
router.post('/photo', multerConfig.single('profilePhoto'), async (req, res) => {
  if (!req.oidc.isAuthenticated()) {
    return res.redirect('/login');
  }

  try {
    if (!req.file) {
      req.session.flash = { error: ['Please select a photo to upload'] };
      return res.redirect('/profile/edit');
    }

    // Store the full URL path to the uploaded file
    const photoUrl = `/uploads/${req.file.filename}`;
    console.log('Uploaded photo URL:', photoUrl); // Debug log

    const updatedUser = await User.findOneAndUpdate(
      { email: req.oidc.user.email },
      { picture: photoUrl },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      console.error('User not found for email:', req.oidc.user.email);
      req.session.flash = { error: ['User not found'] };
      return res.redirect('/profile/edit');
    }

    console.log('Updated user:', updatedUser); // Debug log
    req.session.flash = { success: ['Profile photo updated successfully'] };
    res.redirect('/profile/edit');
  } catch (err) {
    console.error('Error updating profile photo:', err);
    req.session.flash = { error: ['Failed to update profile photo'] };
    res.redirect('/profile/edit');
  }
});

module.exports = router;
