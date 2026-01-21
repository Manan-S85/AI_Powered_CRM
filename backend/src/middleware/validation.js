const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Validation Middleware
 * Handles request validation using express-validator
 */

/**
 * Validate request and return errors if any
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location
    }));

    logger.warn('Validation failed', {
      url: req.originalUrl,
      method: req.method,
      errors: errorMessages,
      body: req.body,
      userId: req.user?.id
    });

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }

  next();
};

/**
 * Sanitize request data
 */
const sanitizeRequest = (req, res, next) => {
  // Remove any null or undefined values from body
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (req.body[key] === null || req.body[key] === undefined) {
        delete req.body[key];
      }
      
      // Trim string values
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }

  next();
};

/**
 * Validate MongoDB ObjectId
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`
      });
    }

    next();
  };
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  // Validate page
  if (page !== undefined) {
    const pageNum = parseInt(page);
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: 'Page must be a positive integer'
      });
    }
    req.query.page = pageNum;
  }

  // Validate limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }
    req.query.limit = limitNum;
  }

  next();
};

/**
 * Validate date range
 */
const validateDateRange = (startDateParam = 'startDate', endDateParam = 'endDate') => {
  return (req, res, next) => {
    const { [startDateParam]: startDate, [endDateParam]: endDate } = req.query;

    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${startDateParam} format. Use YYYY-MM-DD or ISO 8601 format.`
      });
    }

    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${endDateParam} format. Use YYYY-MM-DD or ISO 8601 format.`
      });
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start > end) {
        return res.status(400).json({
          success: false,
          message: 'Start date cannot be later than end date'
        });
      }

      // Check if date range is too large (more than 2 years)
      const twoYears = 2 * 365 * 24 * 60 * 60 * 1000;
      if (end - start > twoYears) {
        return res.status(400).json({
          success: false,
          message: 'Date range cannot exceed 2 years'
        });
      }
    }

    next();
  };
};

/**
 * Validate sort parameters
 */
const validateSort = (allowedSortFields = []) => {
  return (req, res, next) => {
    const { sortBy, sortOrder } = req.query;

    if (sortBy && allowedSortFields.length > 0 && !allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy field. Allowed values: ${allowedSortFields.join(', ')}`
      });
    }

    if (sortOrder && !['asc', 'desc'].includes(sortOrder.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Sort order must be either "asc" or "desc"'
      });
    }

    // Normalize sortOrder
    if (sortOrder) {
      req.query.sortOrder = sortOrder.toLowerCase();
    }

    next();
  };
};

/**
 * Validate file upload
 */
const validateFileUpload = (options = {}) => {
  const {
    allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'],
    maxSize = 5 * 1024 * 1024, // 5MB
    required = false
  } = options;

  return (req, res, next) => {
    if (!req.file) {
      if (required) {
        return res.status(400).json({
          success: false,
          message: 'File upload is required'
        });
      }
      return next();
    }

    // Check file type
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
      });
    }

    // Check file size
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File size too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
      });
    }

    next();
  };
};

/**
 * Validate search query
 */
const validateSearchQuery = (req, res, next) => {
  const { q, search } = req.query;
  const query = q || search;

  if (query !== undefined) {
    if (typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query cannot be empty'
      });
    }

    if (query.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Search query cannot exceed 100 characters'
      });
    }

    // Sanitize search query
    req.query.q = query.trim();
    req.query.search = query.trim();
  }

  next();
};

/**
 * Validate array parameters
 */
const validateArrayParam = (paramName, options = {}) => {
  const { allowedValues = [], maxLength = 10, required = false } = options;

  return (req, res, next) => {
    let param = req.query[paramName] || req.body[paramName];

    if (!param) {
      if (required) {
        return res.status(400).json({
          success: false,
          message: `${paramName} is required`
        });
      }
      return next();
    }

    // Convert string to array if needed
    if (typeof param === 'string') {
      param = param.split(',').map(item => item.trim());
    }

    if (!Array.isArray(param)) {
      return res.status(400).json({
        success: false,
        message: `${paramName} must be an array`
      });
    }

    if (param.length > maxLength) {
      return res.status(400).json({
        success: false,
        message: `${paramName} cannot have more than ${maxLength} items`
      });
    }

    if (allowedValues.length > 0) {
      const invalidValues = param.filter(value => !allowedValues.includes(value));
      if (invalidValues.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid values in ${paramName}: ${invalidValues.join(', ')}. Allowed values: ${allowedValues.join(', ')}`
        });
      }
    }

    // Update request with processed array
    if (req.query[paramName]) {
      req.query[paramName] = param;
    }
    if (req.body[paramName]) {
      req.body[paramName] = param;
    }

    next();
  };
};

/**
 * Helper function to validate date string
 */
function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Custom validation for specific business rules
 */
const customValidation = (validatorFn) => {
  return async (req, res, next) => {
    try {
      const result = await validatorFn(req);
      
      if (result.isValid) {
        next();
      } else {
        return res.status(400).json({
          success: false,
          message: result.message || 'Validation failed',
          errors: result.errors
        });
      }
    } catch (error) {
      logger.error('Custom validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Validation error occurred'
      });
    }
  };
};

module.exports = {
  validateRequest,
  sanitizeRequest,
  validateObjectId,
  validatePagination,
  validateDateRange,
  validateSort,
  validateFileUpload,
  validateSearchQuery,
  validateArrayParam,
  customValidation
};