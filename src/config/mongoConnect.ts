import mongoose from 'mongoose';
import envConfig from './envConfig.js';

const connectDB = async (): Promise<void> => {
  try {
    // Assert the string exists or let Mongoose throw if undefined
    const connectionString = envConfig.MONGO_CONNECTION_STRING as string;

    const conn = await mongoose.connect(connectionString, {
      autoIndex: envConfig.NODE_ENV !== 'production', // Disable autoIndex in production
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

 console.log("MongoDB Connected:", conn.connection.host);
  } catch (error) {
    const err = error as Error;
     console.error("Error connecting to MongoDB:", err.message);
    process.exit(1);
  }
};

// Connection Lifecycle Event Listeners
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB connection lost. Attempting to reconnect...');
});

mongoose.connection.on('error', (err: Error) => {
 console.error("MongoDB connection error:", err);
});

export default connectDB;
  