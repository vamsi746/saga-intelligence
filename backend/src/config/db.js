const mongoose = require('mongoose');

const connectDB = async (retryCount = 5) => {
  try {
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/blura_hub';
    const dbName = process.env.DB_NAME ? String(process.env.DB_NAME).trim() : undefined;

    await mongoose.connect(dbUri, dbName ? { dbName } : undefined);
    console.log(`MongoDB Connected: successfully to database`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (retryCount > 0) {
      console.log(`Retrying connection in 5 seconds... (${retryCount} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retryCount - 1);
    }
    process.exit(1);
  }
};

module.exports = connectDB;
