const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Database connection configuration
 */
class Database {
  constructor() {
    this.isConnected = false;
  }

  /**
   * Connect to MongoDB
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      if (this.isConnected) {
        logger.info('MongoDB is already connected');
        return;
      }

      const mongoURI = process.env.NODE_ENV === 'test' 
        ? process.env.MONGODB_TEST_URI 
        : process.env.MONGODB_URI;

      if (!mongoURI) {
        throw new Error('MongoDB URI is not defined in environment variables');
      }

      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
        bufferMaxEntries: 0,
      };

      await mongoose.connect(mongoURI, options);

      this.isConnected = true;
      logger.info(`MongoDB connected successfully to ${mongoURI.split('@')[1] || 'localhost'}`);

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

      // Graceful shutdown
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

    } catch (error) {
      logger.error('Failed to connect to MongoDB:', error.message);
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      if (!this.isConnected) {
        logger.info('MongoDB is already disconnected');
        return;
      }

      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('MongoDB disconnected gracefully');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error.message);
      throw error;
    }
  }

  /**
   * Get connection status
   * @returns {boolean}
   */
  getConnectionStatus() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Clear database (for testing purposes)
   * @returns {Promise<void>}
   */
  async clearDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Database clearing is only allowed in test environment');
    }

    try {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        await collections[key].deleteMany({});
      }
      logger.info('Test database cleared');
    } catch (error) {
      logger.error('Error clearing test database:', error.message);
      throw error;
    }
  }
}

// Create singleton instance
const database = new Database();

module.exports = database;