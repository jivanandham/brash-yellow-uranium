const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId: {
    type: String,  // Changed from ObjectId to String to support Auth0 IDs
    required: true,
    unique: true
  },
  notifications: {
    newUser: {
      type: Boolean,
      default: true
    },
    largeTransactions: {
      type: Boolean,
      default: true
    },
    systemAlerts: {
      type: Boolean,
      default: true
    }
  },
  security: {
    sessionTimeout: {
      type: Number,
      default: 30,
      min: 5,
      max: 120
    },
    twoFactorAuth: {
      type: Boolean,
      default: false
    },
    lastPasswordChange: {
      type: Date,
      default: Date.now
    }
  },
  display: {
    itemsPerPage: {
      type: Number,
      enum: [10, 25, 50, 100],
      default: 25
    },
    themeColor: {
      type: String,
      default: '#4299e1'
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY'
    },
    timeFormat: {
      type: String,
      default: '12h'
    }
  },
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  }
}, {
  timestamps: true
});

// Create default settings for a user
settingsSchema.statics.createDefaultSettings = async function(userId) {
  const settings = new this({
    userId,
    notifications: {
      newUser: true,
      largeTransactions: true,
      systemAlerts: true
    },
    security: {
      sessionTimeout: 30,
      twoFactorAuth: false
    },
    display: {
      itemsPerPage: 25,
      themeColor: '#4299e1'
    }
  });

  return settings.save();
};

module.exports = mongoose.model('Settings', settingsSchema);
