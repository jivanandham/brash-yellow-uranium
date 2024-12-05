const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

const sessionConfig = session({
  secret: process.env.SESSION_SECRET || 'defaultSecret', // Replace with a strong secret key
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 10 * 60 * 60 * 24, // 1 day
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Secure cookies in production
  },
  store: MongoStore.create({
    mongoUrl: process.env.MONGO_URI, // MongoDB connection URI
    collectionName: 'sessions',
  }),
});

module.exports = sessionConfig;
