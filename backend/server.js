require('dotenv').config();
const app = require('./app');
const database = require('./config/db');
const logger = require('./utils/logger');

/**
 * Server startup and initialization
 */

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Connect to database
    await database.connect();
    logger.info('Database connection established successfully');

    // Start HTTP server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server is running in ${NODE_ENV} mode on port ${PORT}`);
      logger.info(`📊 API Documentation available at http://localhost:${PORT}/api`);
      logger.info(`💚 Health check available at http://localhost:${PORT}/health`);
    });

    // Store server reference for graceful shutdown
    app.set('server', server);

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

      // Handle specific listen errors with friendly messages
      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      gracefulShutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

/**
 * Graceful shutdown
 */
const gracefulShutdown = async (exitCode = 0) => {
  logger.info('Starting graceful shutdown...');
  
  const server = app.get('server');
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await database.disconnect();
        logger.info('Database connection closed');
      } catch (error) {
        logger.error('Error closing database connection:', error);
      }
      
      logger.info('Graceful shutdown completed');
      process.exit(exitCode);
    });

    // Force close server after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    try {
      await database.disconnect();
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }
    process.exit(exitCode);
  }
};

// Start the server
startServer();

module.exports = { startServer, gracefulShutdown };