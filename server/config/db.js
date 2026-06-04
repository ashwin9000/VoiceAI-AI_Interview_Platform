const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose.
 * Reads MONGODB_URI from environment variables.
 * Logs connection success or exits process on failure.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
