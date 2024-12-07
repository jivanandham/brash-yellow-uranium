const helmet = require('helmet');

const helmetConfig = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],  // Only allow content from the same origin
    scriptSrc: [
      "'self'", 
      "'unsafe-inline'", 
      "'unsafe-eval'",
      "https://apis.google.com", 
      "https://cdn.jsdelivr.net", 
      "https://cdnjs.cloudflare.com",
      "https://code.jquery.com",
      "blob:"
    ],
    scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
    scriptSrcElem: [
      "'self'",
      "'unsafe-inline'",
      "https://apis.google.com",
      "https://cdn.jsdelivr.net",
      "https://cdnjs.cloudflare.com",
      "https://code.jquery.com",
      "blob:"
    ],
    styleSrc: [
      "'self'", 
      "'unsafe-inline'", 
      "https://cdnjs.cloudflare.com",
      "https://cdn.jsdelivr.net"
    ],
    styleSrcElem: [
      "'self'",
      "'unsafe-inline'",
      "https://cdnjs.cloudflare.com",
      "https://cdn.jsdelivr.net"
    ],
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
    connectSrc: [
      "'self'", 
      "https://www.google-analytics.com",
      "wss://*",
      "ws://*"
    ],
    fontSrc: [
      "'self'", 
      "https://cdnjs.cloudflare.com",
      "https://cdn.jsdelivr.net"
    ],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    upgradeInsecureRequests: [],
  },
});

module.exports = helmetConfig;
