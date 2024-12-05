const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
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
  store: new MongoStore({
    url: process.env.MONGO_URI, // MongoDB connection URI
    collection: 'sessions',
  }),
});

module.exports = sessionConfig;
