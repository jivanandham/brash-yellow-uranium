const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  error: { type: String, required: true },
  stack: { type: String, required: true },
  url: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ErrorLog', ErrorLogSchema, 'errorlogs');
