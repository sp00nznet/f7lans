const mongoose = require('mongoose');

const connectDB = async (retries = 5, delay = 5000) => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/f7lans';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`MongoDB connection attempt ${attempt}/${retries}...`);

      const conn = await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 10000,
      });

      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt} failed:`, error.message);

      if (attempt === retries) {
        console.error('All MongoDB connection attempts failed. Exiting.');
        process.exit(1);
      }

      console.log(`Retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

module.exports = connectDB;
