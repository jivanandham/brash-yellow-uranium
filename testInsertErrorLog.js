require('dotenv').config();
const mongoose = require('mongoose');
const ErrorLog = require('./models/ErrorLog'); // Ensure the path is correct

const sampleError = {
  userId: '6475e3b2c59b4c76b3d8e6f1', // Replace with a valid ObjectId from your database
  error: 'TypeError: Cannot read properties of undefined',
  stack: `TypeError: Cannot read properties of undefined
    at /path/to/your/app.js:25:15
    at Layer.handle [as handle_request] (/node_modules/express/lib/router/layer.js:95:5)`,
  url: '/test-route',
  timestamp: new Date(),
};

async function insertSampleError() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const result = await ErrorLog.create(sampleError);
    console.log('Sample error log inserted successfully:', result);

    mongoose.disconnect();
  } catch (err) {
    console.error('Error inserting sample log:', err);
    mongoose.disconnect();
  }
}

insertSampleError();
