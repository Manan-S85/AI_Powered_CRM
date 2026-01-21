const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

// Rate limiting for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset requests per hour
  message: {
    error: 'Too many password reset attempts, please try again later.'
  }
});

// Validation rules
const authValidationRules = {
  register: [
    body('firstName')
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ max: 50 })
      .withMessage('First name cannot exceed 50 characters')
      .trim(),
    body('lastName')
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ max: 50 })
      .withMessage('Last name cannot exceed 50 characters')
      .trim(),
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail()
      .toLowerCase(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    body('role')
      .optional()
      .isIn(['Admin', 'Manager', 'Sales Rep', 'Marketing', 'Viewer'])
      .withMessage('Invalid role'),
    body('department')
      .optional()
      .isIn(['Sales', 'Marketing', 'Customer Success', 'Management', 'IT', 'HR', 'Other'])
      .withMessage('Invalid department'),
    body('jobTitle')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Job title cannot exceed 100 characters')
      .trim()
  ],

  login: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail()
      .toLowerCase(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  forgotPassword: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail()
      .toLowerCase()
  ],

  resetPassword: [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      })
  ],

  changePassword: [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Passwords do not match');
        }
        return true;
      })
  ],

  updateProfile: [
    body('firstName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('First name cannot exceed 50 characters')
      .trim(),
    body('lastName')
      .optional()
      .isLength({ max: 50 })
      .withMessage('Last name cannot exceed 50 characters')
      .trim(),
    body('phone')
      .optional()
      .matches(/^[\+]?[1-9][\d]{0,15}$/)
      .withMessage('Please provide a valid phone number'),
    body('department')
      .optional()
      .isIn(['Sales', 'Marketing', 'Customer Success', 'Management', 'IT', 'HR', 'Other'])
      .withMessage('Invalid department'),
    body('jobTitle')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Job title cannot exceed 100 characters')
      .trim(),
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio cannot exceed 500 characters')
      .trim()
  ]
};

// Public routes (no authentication required)
// POST /api/auth/register - Register a new user
router.post('/register', 
  authLimiter,
  authValidationRules.register,
  validateRequest,
  authController.register
);

// POST /api/auth/login - Login user
router.post('/login', 
  authLimiter,
  authValidationRules.login,
  validateRequest,
  authController.login
);

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', 
  resetPasswordLimiter,
  authValidationRules.forgotPassword,
  validateRequest,
  authController.forgotPassword
);

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', 
  resetPasswordLimiter,
  authValidationRules.resetPassword,
  validateRequest,
  authController.resetPassword
);

// POST /api/auth/verify-email - Verify email address
router.post('/verify-email', 
  body('token').notEmpty().withMessage('Verification token is required'),
  validateRequest,
  authController.verifyEmail
);

// POST /api/auth/resend-verification - Resend email verification
router.post('/resend-verification', 
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  validateRequest,
  authController.resendEmailVerification
);

// POST /api/auth/refresh-token - Refresh JWT token
router.post('/refresh-token', 
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  validateRequest,
  authController.refreshToken
);

// Protected routes (authentication required)
// GET /api/auth/me - Get current user profile
router.get('/me', 
  protect, 
  authController.getMe
);

// PUT /api/auth/me - Update current user profile
router.put('/me', 
  protect,
  authValidationRules.updateProfile,
  validateRequest,
  authController.updateProfile
);

// POST /api/auth/change-password - Change password
router.post('/change-password', 
  protect,
  authValidationRules.changePassword,
  validateRequest,
  authController.changePassword
);

// POST /api/auth/logout - Logout user
router.post('/logout', 
  protect, 
  authController.logout
);

// POST /api/auth/logout-all - Logout from all devices
router.post('/logout-all', 
  protect, 
  authController.logoutAll
);

// GET /api/auth/sessions - Get active sessions
router.get('/sessions', 
  protect, 
  authController.getActiveSessions
);

// DELETE /api/auth/sessions/:tokenId - Revoke specific session
router.delete('/sessions/:tokenId', 
  protect, 
  authController.revokeSession
);

// Admin only routes
// GET /api/auth/users - Get all users (Admin only)
router.get('/users', 
  protect, 
  authorize('users', 'read'),
  authController.getAllUsers
);

// GET /api/auth/users/:id - Get user by ID (Admin/Manager)
router.get('/users/:id', 
  protect, 
  authorize('users', 'read'),
  authController.getUserById
);

// PUT /api/auth/users/:id - Update user by ID (Admin only)
router.put('/users/:id', 
  protect, 
  authorize('users', 'update'),
  authValidationRules.updateProfile,
  validateRequest,
  authController.updateUser
);

// DELETE /api/auth/users/:id - Delete user by ID (Admin only)
router.delete('/users/:id', 
  protect, 
  authorize('users', 'delete'),
  authController.deleteUser
);

// PUT /api/auth/users/:id/activate - Activate user account (Admin only)
router.put('/users/:id/activate', 
  protect, 
  authorize('users', 'update'),
  authController.activateUser
);

// PUT /api/auth/users/:id/deactivate - Deactivate user account (Admin only)
router.put('/users/:id/deactivate', 
  protect, 
  authorize('users', 'update'),
  authController.deactivateUser
);

// PUT /api/auth/users/:id/role - Update user role (Admin only)
router.put('/users/:id/role', 
  protect, 
  authorize('users', 'update'),
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['Admin', 'Manager', 'Sales Rep', 'Marketing', 'Viewer'])
    .withMessage('Invalid role'),
  validateRequest,
  authController.updateUserRole
);

// PUT /api/auth/users/:id/permissions - Update user permissions (Admin only)
router.put('/users/:id/permissions', 
  protect, 
  authorize('users', 'update'),
  body('permissions')
    .isArray()
    .withMessage('Permissions must be an array'),
  validateRequest,
  authController.updateUserPermissions
);

// Two-Factor Authentication routes
// POST /api/auth/2fa/enable - Enable 2FA
router.post('/2fa/enable', 
  protect, 
  authController.enableTwoFactorAuth
);

// POST /api/auth/2fa/verify - Verify 2FA setup
router.post('/2fa/verify', 
  protect,
  body('token').isLength({ min: 6, max: 6 }).withMessage('2FA token must be 6 digits'),
  validateRequest,
  authController.verifyTwoFactorAuth
);

// POST /api/auth/2fa/disable - Disable 2FA
router.post('/2fa/disable', 
  protect,
  body('password').notEmpty().withMessage('Password is required'),
  validateRequest,
  authController.disableTwoFactorAuth
);

module.exports = router;