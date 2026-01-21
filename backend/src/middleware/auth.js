const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Authentication and Authorization Middleware
 */

/**
 * Protect routes - Verify JWT token
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from token
      const user = await User.findById(decoded.userId).select('-password -refreshTokens');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Token is invalid - user not found'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        logger.security('Inactive user attempted access', user, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          url: req.originalUrl
        });

        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Add user to request object
      req.user = user;
      next();

    } catch (tokenError) {
      if (tokenError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }

      if (tokenError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }

      throw tokenError;
    }

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Authorize based on permissions
 */
const authorize = (resource, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Check if user has permission
    if (!req.user.hasPermission(resource, action)) {
      logger.security('Unauthorized access attempt', req.user, {
        resource,
        action,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        required: { resource, action }
      });
    }

    next();
  };
};

/**
 * Authorize based on roles
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.security('Role-based access denied', req.user, {
        requiredRoles: roles,
        userRole: req.user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient role permissions.',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

/**
 * Optional authentication - Set user if token is valid but don't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password -refreshTokens');
        
        if (user && user.isActive) {
          req.user = user;
        }
      } catch (tokenError) {
        // Token is invalid or expired, but that's okay for optional auth
        // Just continue without setting req.user
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional authentication middleware error:', error);
    next(); // Continue without authentication
  }
};

/**
 * Check if user owns the resource or has admin privileges
 */
const ownershipOrAdmin = (resourceIdParam = 'id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const resourceId = req.params[resourceIdParam];
    const isOwner = req.user._id.toString() === resourceId;
    const isAdmin = req.user.role === 'Admin';

    if (!isOwner && !isAdmin) {
      logger.security('Ownership/admin check failed', req.user, {
        resourceId,
        resourceIdParam,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own resources.'
      });
    }

    next();
  };
};

/**
 * Rate limiting for sensitive operations
 */
const sensitiveOpLimit = (windowMs = 60000, max = 5) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.user ? req.user._id.toString() : req.ip;
    const now = Date.now();
    
    if (!attempts.has(key)) {
      attempts.set(key, []);
    }

    const userAttempts = attempts.get(key);
    
    // Remove old attempts
    const validAttempts = userAttempts.filter(time => now - time < windowMs);
    
    if (validAttempts.length >= max) {
      logger.security('Sensitive operation rate limit exceeded', req.user, {
        key,
        attempts: validAttempts.length,
        max,
        windowMs,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });

      return res.status(429).json({
        success: false,
        message: 'Too many attempts. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    validAttempts.push(now);
    attempts.set(key, validAttempts);
    
    next();
  };
};

/**
 * Verify email is verified for certain operations
 */
const requireVerifiedEmail = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.isEmailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required for this operation',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  next();
};

/**
 * Check account lock status
 */
const checkAccountLock = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  // Refresh user data to get current lock status
  const currentUser = await User.findById(req.user._id);
  
  if (currentUser && currentUser.isLocked) {
    logger.security('Locked account attempted access', currentUser, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl
    });

    return res.status(423).json({
      success: false,
      message: 'Account is temporarily locked due to too many failed login attempts',
      code: 'ACCOUNT_LOCKED'
    });
  }

  next();
};

module.exports = {
  protect,
  authorize,
  authorizeRoles,
  optionalAuth,
  ownershipOrAdmin,
  sensitiveOpLimit,
  requireVerifiedEmail,
  checkAccountLock
};