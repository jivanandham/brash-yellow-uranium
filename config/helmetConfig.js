const helmet = require('helmet');

const helmetConfig = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],  // Only allow content from the same origin
    scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"], // Allow inline scripts and external sources
    styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"], // Allow inline styles and external styles
    imgSrc: [
      "'self'", 
      "data:", 
      "https://*.googleusercontent.com",
      "https://lh3.googleusercontent.com",
      "https://*.auth0.com",
      "https://s.gravatar.com",
      "blob:",
      "*"
    ],
    connectSrc: ["'self'", "https://www.google-analytics.com"], 
    fontSrc: ["'self'", "https://cdnjs.cloudflare.com"], 
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
});

module.exports = helmetConfig;
