const mongoose = require('mongoose');

const UserActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  activity: { type: String, enum: ['login', 'logout'], required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('UserActivity', UserActivitySchema);
