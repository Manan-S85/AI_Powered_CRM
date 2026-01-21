const winston = require('winston');
const path = require('path');

/**
 * Custom logging configuration using Winston
 * Provides structured logging with different levels and formats
 */

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Create log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}` +
    (info.stack ? `\n${info.stack}` : '') +
    (info.meta && Object.keys(info.meta).length > 0 ? `\n${JSON.stringify(info.meta, null, 2)}` : '')
  ),
);

// Create file format (no colors for files)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(
    (info) => {
      const { timestamp, level, message, stack, ...meta } = info;
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...(stack && { stack }),
        ...(Object.keys(meta).length > 0 && { meta })
      });
    }
  )
);

// Define which transports to use
const transports = [];

// Console transport
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || 'debug',
      format: logFormat
    })
  );
}

// File transports
const logDir = 'logs';

// Error log file
transports.push(
  new winston.transports.File({
    filename: path.join(logDir, 'error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
);

// Combined log file
transports.push(
  new winston.transports.File({
    filename: path.join(logDir, 'combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  })
);

// HTTP log file
transports.push(
  new winston.transports.File({
    filename: path.join(logDir, 'http.log'),
    level: 'http',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 3,
  })
);

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  levels,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
  ),
  transports,
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      format: fileFormat
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'rejections.log'),
      format: fileFormat
    }),
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

// Add request logging middleware
logger.http = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    
    const meta = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id || 'anonymous'
    };

    if (res.statusCode >= 400) {
      logger.error(message, meta);
    } else {
      logger.http(message, meta);
    }
  });
  
  if (next) next();
};

// Add database logging
logger.database = (operation, collection, duration, error) => {
  const message = `DB ${operation.toUpperCase()} on ${collection}`;
  const meta = {
    operation,
    collection,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  };

  if (error) {
    logger.error(`${message} failed: ${error.message}`, { ...meta, error: error.message });
  } else {
    logger.debug(`${message} completed in ${duration}ms`, meta);
  }
};

// Add security logging
logger.security = (event, user, details) => {
  const message = `SECURITY: ${event}`;
  const meta = {
    event,
    user: user?.email || user?.id || 'unknown',
    userId: user?.id,
    timestamp: new Date().toISOString(),
    ip: details?.ip,
    userAgent: details?.userAgent,
    ...details
  };

  logger.warn(message, meta);
};

// Add business logic logging
logger.business = (event, details) => {
  const message = `BUSINESS: ${event}`;
  const meta = {
    event,
    timestamp: new Date().toISOString(),
    ...details
  };

  logger.info(message, meta);
};

// Add performance logging
logger.performance = (operation, duration, details) => {
  const message = `PERFORMANCE: ${operation} took ${duration}ms`;
  const meta = {
    operation,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...details
  };

  if (duration > 1000) {
    logger.warn(message, meta);
  } else {
    logger.debug(message, meta);
  }
};

// Helper method for logging with context
logger.withContext = (context) => {
  return {
    error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
    http: (message, meta = {}) => logger.http(message, { ...context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
  };
};

// Error logging helper
logger.logError = (error, context = {}) => {
  const message = error.message || 'Unknown error';
  const meta = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode,
    },
    timestamp: new Date().toISOString(),
    ...context
  };

  logger.error(message, meta);
};

// API response logging
logger.apiResponse = (req, res, data, error) => {
  const message = `API Response: ${req.method} ${req.originalUrl}`;
  const meta = {
    method: req.method,
    url: req.originalUrl,
    statusCode: res.statusCode,
    userId: req.user?.id,
    timestamp: new Date().toISOString(),
    dataSize: data ? JSON.stringify(data).length : 0,
    hasError: !!error
  };

  if (error || res.statusCode >= 400) {
    logger.error(`${message} - Error`, { ...meta, error: error?.message });
  } else {
    logger.info(message, meta);
  }
};

// Lead scoring logging
logger.leadScoring = (leadId, score, method, duration) => {
  const message = `Lead Scoring: Lead ${leadId} scored ${score} using ${method}`;
  const meta = {
    leadId,
    score,
    method,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  };

  logger.info(message, meta);
};

// Authentication logging
logger.auth = (event, user, details = {}) => {
  const message = `AUTH: ${event} for user ${user?.email || 'unknown'}`;
  const meta = {
    event,
    userId: user?.id,
    email: user?.email,
    timestamp: new Date().toISOString(),
    ...details
  };

  logger.info(message, meta);
};

// Create logs directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }
  });
  
  // Give the logger time to write before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }
  });
});

// Log application start
logger.info('Logger initialized', {
  environment: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'debug',
  timestamp: new Date().toISOString()
});

module.exports = logger;