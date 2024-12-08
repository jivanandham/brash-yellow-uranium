const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const UserSchema = new mongoose.Schema({
  _id: { 
    type: String,
    default: () => uuidv4()
  },
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true,
    unique: true,
    trim: true,
    lowercase: true
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
    default: 50000 
  },
  bio: { 
    type: String,
    trim: true
  },
  contactNumber: { 
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
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

const User = mongoose.model('User', UserSchema);

module.exports = User;
