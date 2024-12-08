const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const isAdmin = require('../middlewares/isAdmin'); // Middleware to check admin role
// const adminController = require('./controllers/adminController.js');
const ErrorLog = require('../models/ErrorLog');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// Create notification (utility function)
const createNotification = async (userId, title, message, type = 'info') => {
  try {
    const icons = {
      info: 'fas fa-info-circle',
      warning: 'fas fa-exclamation-triangle',
      error: 'fas fa-times-circle',
      success: 'fas fa-check-circle'
    };

    const notification = new Notification({
      userId,
      title,
      message,
      type,
      icon: icons[type] || icons.info
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Utility function to create audit logs
const createAuditLog = async (userId, action, description, eventType, severity, req) => {
    try {
        const auditLog = new AuditLog({
            user: userId,
            action,
            description,
            eventType,
            severity,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            metadata: {
                url: req.originalUrl,
                method: req.method
            }
        });
        await auditLog.save();
    } catch (error) {
        console.error('Error creating audit log:', error);
    }
};

// Admin Dashboard Route
router.get(['/', '/dashboard'], isAdmin, async (req, res) => {
  try {
    // Debug: Log the current user
    console.log('Current user:', req.oidc.user);

    // First, ensure the current admin user exists in the database
    let adminUser = await User.findOne({ email: req.oidc.user.email });
    if (!adminUser) {
      // If the admin doesn't exist in the database, create them
      adminUser = new User({
        name: req.oidc.user.name || req.oidc.user.email.split('@')[0],
        email: req.oidc.user.email,
        picture: req.oidc.user.picture,
        role: 'admin'
      });
      await adminUser.save();
      console.log('Created new admin user:', adminUser);
      
      // Create success notification
      await createNotification(
        req.oidc.user.sub,
        'User Created',
        'Your admin account has been successfully created',
        'success'
      );
      
      // Redirect to users page after creation
      return res.redirect('/admin/users');
    } else if (adminUser.role !== 'admin') {
      // Ensure the user has admin role
      adminUser.role = 'admin';
      await adminUser.save();
      console.log('Updated user to admin:', adminUser);
    }

    // Get counts using direct queries for more accurate results
    try {
      // Get total users (including admins)
      const totalUsers = await User.countDocuments();

      // Get active admins
      const activeAdmins = await User.countDocuments({ 
        role: 'admin'
      });

      // Get recent users (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentUsers = await User.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      });

      // Get total transactions
      const totalTransactions = await Transaction.countDocuments();

      // Calculate growth rate
      const monthlyGrowthRate = totalUsers === 0 ? 0 : Math.round((recentUsers / totalUsers) * 100);

      console.log('Dashboard Stats:', {
        totalUsers,
        totalTransactions,
        activeAdmins,
        recentUsers,
        monthlyGrowthRate
      });

      res.render('admin/admin-dashboard', { 
        user: req.oidc.user,
        totalUsers,
        totalTransactions,
        activeAdmins,
        growthRate: monthlyGrowthRate
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      res.status(500).send('Internal Server Error');
    }
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    console.error(err.stack);
    res.status(500).send('Internal Server Error');
  }
});

// Admin User Management Page
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find();
    res.render('admin/users', { users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Serve Add User Form
router.get('/add-user', (req, res) => {
  res.render('admin/add-user'); // Ensure the view file is located at views/admin/add-user.ejs
});

// Add User Route
router.post('/add-user', isAdmin, async (req, res) => {
  try {
    const { name, email, role } = req.body;

    // Validate required fields
    if (!name || !email || !role) {
      return res.status(400).send('All fields are required.');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send('User with this email already exists.');
    }

    // Create new user
    const newUser = new User({
      name,
      email,
      role,
    });

    await newUser.save();

    // Create notification for admin
    await createNotification(
      req.oidc.user.sub,
      'New User Added',
      `Successfully added new user: ${req.body.email}`,
      'success'
    );

    res.redirect('/admin/users'); // Redirect to the admin user list page
  } catch (error) {
    console.error('Error adding user:', error);
    
    // Create error notification
    await createNotification(
      req.oidc.user.sub,
      'User Addition Failed',
      `Failed to add user: ${error.message}`,
      'error'
    );

    res.status(500).send('Error adding user');
  }
});

// Manage Roles Route
router.get('/manage-roles', async (req, res) => {
  try {
    const users = await User.find(); // Fetch all users from the database
    res.render('admin/manage-roles', { users }); // Render the view with users data
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Edit a user profile (GET form)
router.get('/users/:id/edit', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send('User not found');
    }
    res.render('admin/edit-user', { user });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/edit-user', (req, res) => {
    const error = req.query.error || null; // Simulate an error from query parameters
    res.render('admin/edit-user', { error });
});

// Update user profile (POST form)
router.post('/users/:id/edit', isAdmin, async (req, res) => {
  try {
    const { name, role } = req.body;
    await User.findByIdAndUpdate(req.params.id, { name, role });

    // Create success notification
    await createNotification(
      req.oidc.user.sub,
      'User Updated',
      `Successfully updated user: ${req.body.email}`,
      'success'
    );

    res.redirect('/users');
  } catch (err) {
    console.error('Error updating user:', err);
    
    // Create error notification
    await createNotification(
      req.oidc.user.sub,
      'User Update Failed',
      `Failed to update user: ${err.message}`,
      'error'
    );

    res.status(500).send('Error updating user');
  }
});

// View transactions by user
router.get('/users/:id/transactions', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const transactions = await Transaction.find({ userEmail: user.email }).sort({ date: -1 });
    res.render('admin/user-transactions', { user, transactions });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).send('Internal Server Error');
  }
});

// View active sessions (assuming sessions are stored in MongoDB)
router.get('/users/:id/sessions', isAdmin, async (req, res) => {
  const sessionCollection = mongoose.connection.collection('sessions');
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const sessions = await sessionCollection.find({}).toArray(); // Query sessions
    const userSessions = sessions.filter((session) => {
      const sessionData = JSON.parse(session.session);
      return sessionData.user && sessionData.user.email === user.email;
    });

    res.render('admin/user-sessions', { user, userSessions });
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Display Manage Roles Page
router.get('/users/roles', isAdmin, async (req, res) => {
  try {
    const users = await User.find();
    res.render('admin/manage-roles', { users });
  } catch (err) {
    console.error('Error fetching users for role management:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Update User Role
router.post('/users/roles/update', isAdmin, async (req, res) => {
  const { userId, role } = req.body;

  try {
    await User.findByIdAndUpdate(userId, { role });

    // Create success notification
    await createNotification(
      req.oidc.user.sub,
      'User Role Updated',
      `Successfully updated role for user with ID: ${userId}`,
      'success'
    );

    res.redirect('/users/roles'); // Redirect to the role management page
  } catch (err) {
    console.error('Error updating user role:', err);
    
    // Create error notification
    await createNotification(
      req.oidc.user.sub,
      'User Role Update Failed',
      `Failed to update role for user: ${err.message}`,
      'error'
    );

    res.status(500).send('Internal Server Error');
  }
});

// Admin Settings Routes
router.get('/settings', isAdmin, async (req, res) => {
  try {
    const userId = req.oidc.user.sub;

    // Get user settings
    let settings = await Settings.findOne({ userId });
    
    if (!settings) {
      // Create default settings if none exist
      settings = await Settings.createDefaultSettings(userId);
    }

    // Get recent notifications and unread count
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId, read: false })
        .sort({ date: -1 })
        .limit(5)
        .lean(),
      Notification.countDocuments({ userId, read: false })
    ]);

    res.render('admin/settings', {
      settings,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error in settings route:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Update settings
router.post('/settings', isAdmin, async (req, res) => {
  try {
    const userId = req.oidc.user.sub;
    const { notifications, security, display } = req.body;
    
    const settings = await Settings.findOneAndUpdate(
      { userId },
      {
        notifications,
        security,
        display
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

// Get all notifications
router.get('/notifications', isAdmin, async (req, res) => {
  try {
    const userId = req.oidc.user.sub;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ userId })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await Notification.countDocuments({ userId });
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      notifications,
      currentPage: page,
      totalPages,
      totalCount
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.post('/notifications/:id/read', isAdmin, async (req, res) => {
  try {
    const userId = req.oidc.user.sub;
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Delete notification
router.delete('/notifications/:id', isAdmin, async (req, res) => {
  try {
    const userId = req.oidc.user.sub;
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Add a route to get unread notification count
router.get('/notifications/unread-count', isAdmin, async (req, res) => {
  try {
    const userId = req.oidc.user.sub;
    const count = await Notification.countDocuments({ userId, read: false });
    res.json({ count });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Add a route to mark all notifications as read
router.post('/notifications/mark-all-read', isAdmin, async (req, res) => {
  try {
    const userId = req.oidc.user.sub;
    await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Reports Route (Placeholder)
router.get('/reports/:type', isAdmin, (req, res) => {
  const reportType = req.params.type;
  res.send(`Viewing ${reportType} reports`);
});

router.get('/error-logs', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalLogs = await ErrorLog.countDocuments();
    const totalPages = Math.ceil(totalLogs / limit);

    // Get paginated error logs
    const errorLogs = await ErrorLog.find()
      .populate('userId', 'name email')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    res.render('admin/error-logs', {
      errorLogs,
      user: req.oidc.user,
      pagination: {
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    console.error('Error fetching error logs:', err);
    res.status(500).send('Internal Server Error');
  }
});

// User Transactions route
router.get('/user-transactions', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build filter conditions
    const filter = {};
    if (req.query.startDate && req.query.endDate) {
      filter.date = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }
    if (req.query.type) {
      filter.type = req.query.type;
    }
    if (req.query.user) {
      filter.userEmail = req.query.user;
    }

    // Get transactions with pagination
    const transactions = await Transaction.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalCount = await Transaction.countDocuments(filter);
    const totalPages = Math.ceil(totalCount / limit);

    // Calculate statistics
    const stats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]).exec();

    // Get all users for the filter dropdown
    const users = await User.find({}, 'name email').lean();

    // Get unique transaction types
    const transactionTypes = await Transaction.distinct('type');

    res.render('admin/user-transactions', {
      transactions,
      currentPage: page,
      totalPages,
      stats: stats[0] || {},
      users,
      transactionTypes,
      filters: {
        startDate: req.query.startDate || '',
        endDate: req.query.endDate || '',
        type: req.query.type || '',
        user: req.query.user || ''
      }
    });
  } catch (error) {
    console.error('Error in user-transactions route:', error);
    res.status(500).send('Internal Server Error');
  }
});

// View all user transactions
router.get('/user-transactions', isAdmin, async (req, res) => {
  try {
    // Get query parameters for filtering
    const { startDate, endDate, type, user } = req.query;
    
    // Build the query object
    let query = {};
    
    // Add date range filter if provided
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    
    // Add transaction type filter if provided
    if (type) query.type = type;
    
    // Add user filter if provided
    if (user) query.userEmail = user;

    // Get transactions with pagination
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Get transactions count for pagination
    const totalTransactions = await Transaction.countDocuments(query);
    const totalPages = Math.ceil(totalTransactions / limit);

    // Fetch transactions with user details
    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    // Get unique transaction types for filter dropdown
    const transactionTypes = await Transaction.distinct('type');

    // Get all users for filter dropdown
    const users = await User.find({}, 'name email');

    // Calculate some statistics
    const stats = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.render('admin/user-transactions', {
      transactions,
      currentPage: page,
      totalPages,
      transactionTypes,
      users,
      stats: stats[0] || {},
      filters: { startDate, endDate, type, user }
    });
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Notifications Routes
router.get('/settings/notifications', isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const totalNotifications = await Notification.countDocuments({ userId: req.oidc.user.sub });
    const totalPages = Math.ceil(totalNotifications / limit);

    const notifications = await Notification.find({ userId: req.oidc.user.sub })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    res.render('admin/notifications', {
      user: req.oidc.user,
      notifications,
      currentPage: page,
      totalPages,
      isAdmin: true
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).render('error', {
      user: req.oidc.user,
      error: {
        message: 'Failed to fetch notifications',
        details: error.message
      }
    });
  }
});

// Mark notification as read
router.post('/notifications/:id/read', isAdmin, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.oidc.user.sub },
      { $set: { read: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Delete notification
router.delete('/notifications/:id', isAdmin, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.oidc.user.sub
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Mark all notifications as read
router.post('/notifications/mark-all-read', isAdmin, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.oidc.user.sub, read: false },
      { $set: { read: true } }
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Security Dashboard Route
router.get('/security', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        // Build filter query
        const query = {};
        if (req.query.severity) query.severity = req.query.severity;
        if (req.query.eventType) query.eventType = req.query.eventType;
        if (req.query.dateRange) {
            const [start, end] = req.query.dateRange.split(' - ');
            query.timestamp = {
                $gte: new Date(start),
                $lte: new Date(end)
            };
        }

        // Fetch audit logs with pagination
        const [auditLogs, totalLogs] = await Promise.all([
            AuditLog.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit),
            AuditLog.countDocuments(query)
        ]);

        // Fetch statistics
        const [
            activeUsers,
            securityAlerts,
            failedLogins,
            twoFactorStats
        ] = await Promise.all([
            User.countDocuments({ lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
            AuditLog.countDocuments({ severity: 'high', timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
            AuditLog.countDocuments({ 
                eventType: 'login',
                action: 'failed_login',
                timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }),
            User.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        twoFactorEnabled: {
                            $sum: { $cond: [{ $eq: ['$twoFactorEnabled', true] }, 1, 0] }
                        }
                    }
                }
            ])
        ]);

        // Calculate 2FA percentage
        const twoFactorPercentage = twoFactorStats.length > 0
            ? Math.round((twoFactorStats[0].twoFactorEnabled / twoFactorStats[0].total) * 100)
            : 0;

        // Format chart data
        const chartData = {
            loginAttempts: {
                labels: [],
                successful: [],
                failed: []
            },
            securityIncidents: {
                labels: [],
                data: []
            }
        };

        res.render('admin/security-dashboard', {
            user: req.oidc.user,
            path: '/security',
            auditLogs: auditLogs || [],
            currentPage: page,
            totalPages: Math.ceil(totalLogs / limit),
            stats: {
                activeUsers: activeUsers || 0,
                securityAlerts: securityAlerts || 0,
                failedLogins: failedLogins || 0,
                twoFactorEnabled: twoFactorPercentage || 0
            },
            charts: chartData
        });
    } catch (error) {
        console.error('Error in security dashboard:', error);
        res.status(500).render('error', {
            user: req.oidc.user,
            path: '/security',
            error: {
                message: 'Failed to load security dashboard',
                details: error.message
            }
        });
    }
});

// Audit Logs Route
router.get('/audit-logs', isAdmin, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 10;
        const skip = (page - 1) * itemsPerPage;

        // Get total count for pagination
        const totalItems = await AuditLog.countDocuments();
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // Fetch audit logs with pagination
        const auditLogs = await AuditLog.find()
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(itemsPerPage)
            .lean();

        res.render('admin/security-dashboard', {
            auditLogs,
            currentPage: page,
            totalPages,
            itemsPerPage,
            totalItems
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).render('error', {
            error: 'Failed to fetch audit logs'
        });
    }
});

// Admin Profile Route
router.get('/profile', isAdmin, async (req, res) => {
  try {
    const admin = await User.findOne({ email: req.oidc.user.email });
    if (!admin) {
      return res.status(404).send('Admin not found');
    }

    // Get admin stats
    const totalUsers = await User.countDocuments();
    const totalTransactions = await Transaction.countDocuments();
    const activeAdmins = await User.countDocuments({ role: 'admin' });

    // Calculate growth rate
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });
    const growthRate = totalUsers === 0 ? 0 : Math.round((recentUsers / totalUsers) * 100);

    res.render('admin/profile', {
      user: admin,
      stats: {
        totalUsers,
        totalTransactions,
        activeAdmins,
        growthRate
      },
      isAuthenticated: true
    });
  } catch (error) {
    console.error('Error loading admin profile:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Admin Profile Edit Route
router.get('/profile/edit', isAdmin, async (req, res) => {
  try {
    const admin = await User.findOne({ email: req.oidc.user.email });
    if (!admin) {
      return res.status(404).send('Admin not found');
    }

    res.render('admin/profile-edit', {
      user: admin,
      isAuthenticated: true
    });
  } catch (error) {
    console.error('Error loading admin profile edit:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Update Admin Profile
router.post('/profile/update', isAdmin, async (req, res) => {
  try {
    const { name, bio, contactNumber } = req.body;
    const admin = await User.findOneAndUpdate(
      { email: req.oidc.user.email },
      {
        $set: {
          name: name || req.oidc.user.name,
          bio,
          contactNumber,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Create audit log
    await createAuditLog(
      admin._id,
      'profile_update',
      'Admin profile updated',
      'user_management',
      'info',
      req
    );

    res.json({ success: true, message: 'Profile updated successfully', user: admin });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// Change Admin Password
router.post('/profile/change-password', isAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await User.findOne({ email: req.oidc.user.email });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Verify current password (implement your password verification logic here)
    const isValidPassword = await admin.comparePassword(currentPassword);
    if (!isValidPassword) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    // Create audit log
    await createAuditLog(
      admin._id,
      'password_change',
      'Admin password changed',
      'security',
      'high',
      req
    );

    // Create notification
    await createNotification(
      admin._id,
      'Password Changed',
      'Your admin password has been successfully updated.',
      'success'
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error changing admin password:', error);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

module.exports = router;
