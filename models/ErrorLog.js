const mongoose = require('mongoose');

const ErrorLogSchema = new mongoose.Schema({
  userId: { type: String, default: null },  // Changed from ObjectId to String to support Auth0 IDs
  error: { type: String, required: true },
  stack: { type: String, required: true },
  url: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ErrorLog', ErrorLogSchema, 'errorlogs');
