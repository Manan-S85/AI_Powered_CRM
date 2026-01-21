require('dotenv').config();

const app = require('./app');
const database = require('./config/db');
const logger = require('./utils/logger');

/**
 * Server entry point
 * Handles application startup, database connection, and server initialization
 */

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Server configuration
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Start the server
 */
async function startServer() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await database.connect();
    logger.info('Database connection established successfully');

    // Start HTTP server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`
╔══════════════════════════════════════════════════════════════════════╗
║                    🚀 AI-POWERED CRM API SERVER                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  Server Status: ✅ Running                                           ║
║  Environment: ${NODE_ENV.padEnd(18, ' ')}                                        ║
║  Port: ${PORT.toString().padEnd(23, ' ')}                                        ║
║  Host: ${HOST.padEnd(23, ' ')}                                        ║
║  Database: ✅ Connected                                               ║
║  Process ID: ${process.pid.toString().padEnd(18, ' ')}                                        ║
║  Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024).toString().padEnd(15, ' ')} MB   ║
╠══════════════════════════════════════════════════════════════════════╣
║  🌐 Server URL: http://${HOST}:${PORT}                                    ║
║  📋 Health Check: http://${HOST}:${PORT}/health                          ║
║  🔐 Authentication: http://${HOST}:${PORT}/api/auth                      ║
║  📊 Leads API: http://${HOST}:${PORT}/api/leads                          ║
╚══════════════════════════════════════════════════════════════════════╝
      `);

      logger.business('Server started successfully', {
        port: PORT,
        host: HOST,
        environment: NODE_ENV,
        nodeVersion: process.version,
        pid: process.pid,
        uptime: process.uptime()
      });
    });

    // Store server reference for graceful shutdown
    app.set('server', server);

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? `Pipe ${PORT}` : `Port ${PORT}`;

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
          logger.error('Server error:', error);
          throw error;
      }
    });

    // Handle server close
    server.on('close', () => {
      logger.info('HTTP Server closed');
    });

    // Handle process termination
    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await database.disconnect();
          logger.info('Database connection closed');
        } catch (dbError) {
          logger.error('Error closing database connection:', dbError);
        }
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception - Server will shutdown:', {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      });
      
      // Attempt graceful shutdown
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection - Server will shutdown:', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString(),
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage()
        }
      });
      
      // Attempt graceful shutdown
      setTimeout(() => {
        process.exit(1);
      }, 5000);
    });

    // Log system information
    logger.info('System Information:', {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      pid: process.pid,
      ppid: process.ppid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      environment: {
        NODE_ENV,
        PORT,
        HOST,
        LOG_LEVEL: process.env.LOG_LEVEL || 'info'
      }
    });

    // Set up periodic health checks
    if (NODE_ENV === 'production') {
      setInterval(() => {
        const memoryUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        logger.debug('Health Check:', {
          uptime: process.uptime(),
          memoryUsage: {
            heapUsed: `${heapUsedMB}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`
          },
          cpuUsage: process.cpuUsage(),
          databaseStatus: database.getConnectionStatus() ? 'connected' : 'disconnected'
        });

        // Alert on high memory usage
        if (heapUsedMB > 500) { // Alert if using more than 500MB
          logger.warn('High memory usage detected:', {
            heapUsed: `${heapUsedMB}MB`,
            threshold: '500MB'
          });
        }
      }, 60000); // Every minute
    }

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Start the application
 */
if (require.main === module) {
  startServer().catch((error) => {
    logger.error('Application startup failed:', error);
    process.exit(1);
  });
}

// Handle development environment specifics
if (NODE_ENV === 'development') {
  logger.info('Development mode active - Enhanced logging and debugging enabled');
  
  // Log all environment variables (excluding sensitive ones)
  const safeEnvVars = {};
  Object.keys(process.env).forEach(key => {
    if (!['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGODB_URI', 'ML_API_KEY', 'EMAIL_PASS'].includes(key)) {
      safeEnvVars[key] = process.env[key];
    } else {
      safeEnvVars[key] = '[HIDDEN]';
    }
  });
  
  logger.debug('Environment Variables:', safeEnvVars);
}

// Export for testing purposes
module.exports = app;