const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Authentication Controller
 * Handles all authentication and user management operations
 */
class AuthController {

  /**
   * Generate JWT tokens
   */
  generateTokens(userId) {
    const accessToken = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    const refreshToken = jwt.sign(
      { userId, type: 'refresh' },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
    );

    return { accessToken, refreshToken };
  }

  /**
   * @desc    Register new user
   * @route   POST /api/auth/register
   * @access  Public
   */
  async register(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        role,
        department,
        jobTitle
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Create user
      const userData = {
        firstName,
        lastName,
        email,
        password,
        department,
        jobTitle
      };

      // Only allow role assignment by Admin users
      if (req.user && req.user.role === 'Admin') {
        userData.role = role;
      }

      const user = await User.create(userData);

      // Generate email verification token
      const verificationToken = user.createEmailVerificationToken();
      await user.save();

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user._id);

      // Add refresh token to user
      await user.addRefreshToken(refreshToken, req.get('User-Agent'), req.ip);

      // Remove sensitive data
      user.password = undefined;

      res.status(201).json({
        success: true,
        data: {
          user,
          accessToken,
          refreshToken
        },
        message: 'User registered successfully. Please verify your email.'
      });

      logger.info(`New user registered: ${email}`);

      // TODO: Send verification email
      // await emailService.sendVerificationEmail(email, verificationToken);

    } catch (error) {
      logger.error('Registration error:', error);

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Registration failed',
        error: error.message
      });
    }
  }

  /**
   * @desc    Login user
   * @route   POST /api/auth/login
   * @access  Public
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user and include password
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Check if account is locked
      if (user.isLocked) {
        return res.status(423).json({
          success: false,
          message: 'Account is temporarily locked due to too many login attempts'
        });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Check password
      const isPasswordMatch = await user.comparePassword(password);

      if (!isPasswordMatch) {
        // Increment login attempts
        await user.incLoginAttempts();
        
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts();
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user._id);

      // Add refresh token to user
      await user.addRefreshToken(refreshToken, req.get('User-Agent'), req.ip);

      // Remove sensitive data
      user.password = undefined;
      user.refreshTokens = undefined;

      res.status(200).json({
        success: true,
        data: {
          user,
          accessToken,
          refreshToken
        },
        message: 'Login successful'
      });

      logger.info(`User logged in: ${email}`);

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }

  /**
   * @desc    Forgot password
   * @route   POST /api/auth/forgot-password
   * @access  Public
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findByEmail(email);

      if (!user) {
        // Don't reveal whether email exists or not
        return res.status(200).json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }

      // Generate reset token
      const resetToken = user.createPasswordResetToken();
      await user.save();

      res.status(200).json({
        success: true,
        message: 'Password reset link has been sent to your email'
      });

      logger.info(`Password reset requested for: ${email}`);

      // TODO: Send reset email
      // await emailService.sendPasswordResetEmail(email, resetToken);

    } catch (error) {
      logger.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing password reset request'
      });
    }
  }

  /**
   * @desc    Reset password
   * @route   POST /api/auth/reset-password
   * @access  Public
   */
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      // Hash the token to match stored version
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Password reset token is invalid or has expired'
        });
      }

      // Set new password
      user.password = password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.loginAttempts = 0;
      user.lockUntil = undefined;

      await user.save();

      res.status(200).json({
        success: true,
        message: 'Password has been reset successfully'
      });

      logger.info(`Password reset successful for user: ${user.email}`);

    } catch (error) {
      logger.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Error resetting password'
      });
    }
  }

  /**
   * @desc    Verify email
   * @route   POST /api/auth/verify-email
   * @access  Public
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.body;

      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() }
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Email verification token is invalid or has expired'
        });
      }

      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;

      await user.save();

      res.status(200).json({
        success: true,
        message: 'Email verified successfully'
      });

      logger.info(`Email verified for user: ${user.email}`);

    } catch (error) {
      logger.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying email'
      });
    }
  }

  /**
   * @desc    Resend email verification
   * @route   POST /api/auth/resend-verification
   * @access  Public
   */
  async resendEmailVerification(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findByEmail(email);

      if (!user || user.isEmailVerified) {
        return res.status(200).json({
          success: true,
          message: 'If the email exists and is not verified, a verification link has been sent.'
        });
      }

      const verificationToken = user.createEmailVerificationToken();
      await user.save();

      res.status(200).json({
        success: true,
        message: 'Verification email has been resent'
      });

      // TODO: Send verification email
      // await emailService.sendVerificationEmail(email, verificationToken);

    } catch (error) {
      logger.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error resending verification email'
      });
    }
  }

  /**
   * @desc    Refresh token
   * @route   POST /api/auth/refresh-token
   * @access  Public
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken, 
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );

      // Find user with this refresh token
      const user = await User.findOne({
        _id: decoded.userId,
        'refreshTokens.token': refreshToken
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(user._id);

      // Remove old refresh token and add new one
      await user.removeRefreshToken(refreshToken);
      await user.addRefreshToken(newRefreshToken, req.get('User-Agent'), req.ip);

      res.status(200).json({
        success: true,
        data: {
          accessToken,
          refreshToken: newRefreshToken
        }
      });

    } catch (error) {
      logger.error('Refresh token error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  }

  /**
   * @desc    Get current user profile
   * @route   GET /api/auth/me
   * @access  Private
   */
  async getMe(req, res) {
    try {
      res.status(200).json({
        success: true,
        data: req.user
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching profile'
      });
    }
  }

  /**
   * @desc    Update current user profile
   * @route   PUT /api/auth/me
   * @access  Private
   */
  async updateProfile(req, res) {
    try {
      const allowedFields = [
        'firstName', 'lastName', 'phone', 'department', 
        'jobTitle', 'bio', 'avatar', 'socialLinks', 'preferences'
      ];

      const updates = {};
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      const user = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
      );

      res.status(200).json({
        success: true,
        data: user,
        message: 'Profile updated successfully'
      });

      logger.info(`Profile updated for user: ${user.email}`);

    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating profile',
        error: error.message
      });
    }
  }

  /**
   * @desc    Change password
   * @route   POST /api/auth/change-password
   * @access  Private
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const user = await User.findById(req.user._id).select('+password');

      // Check current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });

      logger.info(`Password changed for user: ${user.email}`);

    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Error changing password'
      });
    }
  }

  /**
   * @desc    Logout user
   * @route   POST /api/auth/logout
   * @access  Private
   */
  async logout(req, res) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await req.user.removeRefreshToken(refreshToken);
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });

      logger.info(`User logged out: ${req.user.email}`);

    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Error logging out'
      });
    }
  }

  /**
   * @desc    Logout from all devices
   * @route   POST /api/auth/logout-all
   * @access  Private
   */
  async logoutAll(req, res) {
    try {
      req.user.refreshTokens = [];
      await req.user.save();

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully'
      });

      logger.info(`User logged out from all devices: ${req.user.email}`);

    } catch (error) {
      logger.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Error logging out from all devices'
      });
    }
  }

  // Additional methods for admin functions, 2FA, sessions, etc.
  async getAllUsers(req, res) {
    res.status(501).json({ message: 'Get all users not implemented yet' });
  }

  async getUserById(req, res) {
    res.status(501).json({ message: 'Get user by ID not implemented yet' });
  }

  async updateUser(req, res) {
    res.status(501).json({ message: 'Update user not implemented yet' });
  }

  async deleteUser(req, res) {
    res.status(501).json({ message: 'Delete user not implemented yet' });
  }

  async activateUser(req, res) {
    res.status(501).json({ message: 'Activate user not implemented yet' });
  }

  async deactivateUser(req, res) {
    res.status(501).json({ message: 'Deactivate user not implemented yet' });
  }

  async updateUserRole(req, res) {
    res.status(501).json({ message: 'Update user role not implemented yet' });
  }

  async updateUserPermissions(req, res) {
    res.status(501).json({ message: 'Update user permissions not implemented yet' });
  }

  async getActiveSessions(req, res) {
    res.status(501).json({ message: 'Get active sessions not implemented yet' });
  }

  async revokeSession(req, res) {
    res.status(501).json({ message: 'Revoke session not implemented yet' });
  }

  async enableTwoFactorAuth(req, res) {
    res.status(501).json({ message: '2FA enable not implemented yet' });
  }

  async verifyTwoFactorAuth(req, res) {
    res.status(501).json({ message: '2FA verify not implemented yet' });
  }

  async disableTwoFactorAuth(req, res) {
    res.status(501).json({ message: '2FA disable not implemented yet' });
  }
}

module.exports = new AuthController();