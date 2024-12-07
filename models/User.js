const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  _id: { 
    type: String,
    required: true
  },
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  picture: { 
    type: String 
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  walletBalance: { 
    type: Number, 
    default: 0 
  },
  bio: { 
    type: String 
  },
  contactNumber: { 
    type: String 
  },
  watchlist: [{
    symbol: { 
      type: String, 
      required: true 
    },
    name: { 
      type: String, 
      required: true 
    },
    addedAt: { 
      type: Date, 
      default: Date.now 
    }
  }]
}, {
  timestamps: true // This adds createdAt and updatedAt fields automatically
});

// Create indexes
UserSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);
