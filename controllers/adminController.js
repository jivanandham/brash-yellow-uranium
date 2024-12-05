const User = require('../models/User');
const ErrorLog = require('../models/ErrorLog');

// Admin Dashboard Controller
exports.getAdminDashboard = async (req, res) => {
  try {
    const users = await User.find();
    res.render('admin-dashboard', { user: req.oidc.user, users });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).send('Internal Server Error');
  }
};

// User Management Page Controller
exports.getUserManagement = async (req, res) => {
  try {
    const users = await User.find();
    res.render('admin/users', { users });
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).send('Internal Server Error');
  }
};


exports.getErrorLogs = async (req, res) => {
  try {
    const errorLogs = await ErrorLog.find().sort({ timestamp: -1 });
    res.render('admin/error-logs', { errorLogs, user: req.user || null });
  } catch (err) {
    console.error('Error fetching error logs:', err);
    res.status(500).send('Internal Server Error');
  }
};

// Reports Controller
exports.getReports = (req, res) => {
  const reportType = req.params.type;
  res.send(`Viewing ${reportType} reports`);
};

// Settings Controller
exports.getSettings = (req, res) => {
  res.render('admin/settings');
};
