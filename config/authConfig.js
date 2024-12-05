require("dotenv").config();

if (!process.env.AUTH0_SECRET || !process.env.BASE_URL || !process.env.AUTH0_CLIENT_ID || !process.env.AUTH0_DOMAIN) {
  throw new Error("Missing required Auth0 environment variables");
}

const authConfig = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: process.env.BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  };

module.exports = authConfig;
