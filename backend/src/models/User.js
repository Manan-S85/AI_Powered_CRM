const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema for CRM system
 * Represents system users with authentication and role management
 */
const userSchema = new mongoose.Schema({
  // Personal Information
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  // Authentication
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },

  // Profile Information
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  department: {
    type: String,
    enum: ['Sales', 'Marketing', 'Customer Success', 'Management', 'IT', 'HR', 'Other']
  },
  jobTitle: {
    type: String,
    trim: true,
    maxlength: [100, 'Job title cannot exceed 100 characters']
  },

  // Role and Permissions
  role: {
    type: String,
    required: [true, 'User role is required'],
    enum: ['Admin', 'Manager', 'Sales Rep', 'Marketing', 'Viewer'],
    default: 'Sales Rep'
  },
  permissions: [{
    resource: {
      type: String,
      enum: ['leads', 'users', 'reports', 'settings', 'analytics']
    },
    actions: [{
      type: String,
      enum: ['create', 'read', 'update', 'delete', 'export']
    }]
  }],

  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },

  // Preferences and Settings
  preferences: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'it', 'pt']
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    dateFormat: {
      type: String,
      default: 'MM/DD/YYYY',
      enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']
    },
    notifications: {
      email: {
        newLeads: { type: Boolean, default: true },
        leadUpdates: { type: Boolean, default: true },
        reminders: { type: Boolean, default: true },
        reports: { type: Boolean, default: false }
      },
      browser: {
        newLeads: { type: Boolean, default: true },
        leadUpdates: { type: Boolean, default: true },
        reminders: { type: Boolean, default: true }
      }
    },
    dashboard: {
      defaultView: {
        type: String,
        default: 'overview',
        enum: ['overview', 'leads', 'pipeline', 'reports']
      },
      itemsPerPage: {
        type: Number,
        default: 25,
        min: 10,
        max: 100
      }
    }
  },

  // Performance Metrics
  metrics: {
    totalLeads: { type: Number, default: 0 },
    convertedLeads: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    averageLeadScore: { type: Number, default: 0 },
    lastActivityDate: { type: Date }
  },

  // Two-Factor Authentication
  twoFactorAuth: {
    isEnabled: { type: Boolean, default: false },
    secret: { type: String, select: false },
    backupCodes: [{ type: String, select: false }]
  },

  // Refresh Token for JWT
  refreshTokens: [{
    token: { type: String, select: false },
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    userAgent: String,
    ipAddress: String
  }],

  // Additional Fields
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  socialLinks: {
    linkedin: String,
    twitter: String,
    website: String
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshTokens;
      delete ret.passwordResetToken;
      delete ret.emailVerificationToken;
      delete ret.twoFactorAuth;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ department: 1 });
userSchema.index({ createdAt: -1 });

// Compound indexes
userSchema.index({ isActive: 1, role: 1 });
userSchema.index({ department: 1, role: 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Virtual for conversion rate
userSchema.virtual('conversionRate').get(function() {
  if (this.metrics.totalLeads === 0) return 0;
  return ((this.metrics.convertedLeads / this.metrics.totalLeads) * 100).toFixed(2);
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Only hash password if it's been modified
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  
  this.passwordResetToken = require('crypto')
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = require('crypto').randomBytes(32).toString('hex');
  
  this.emailVerificationToken = require('crypto')
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

userSchema.methods.hasPermission = function(resource, action) {
  // Admin has all permissions
  if (this.role === 'Admin') return true;
  
  const permission = this.permissions.find(p => p.resource === resource);
  return permission && permission.actions.includes(action);
};

userSchema.methods.updateMetrics = function(metrics) {
  this.metrics = { ...this.metrics.toObject(), ...metrics };
  this.metrics.lastActivityDate = new Date();
  return this.save();
};

userSchema.methods.addRefreshToken = function(token, userAgent, ipAddress) {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  this.refreshTokens.push({
    token,
    expiresAt,
    userAgent,
    ipAddress
  });

  // Keep only the last 5 refresh tokens
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }

  return this.save();
};

userSchema.methods.removeRefreshToken = function(token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
  return this.save();
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.getActiveUsers = function() {
  return this.find({ isActive: true }).select('-password -refreshTokens');
};

userSchema.statics.getUsersByRole = function(role) {
  return this.find({ role, isActive: true }).select('-password -refreshTokens');
};

userSchema.statics.getUsersWithPermission = function(resource, action) {
  return this.find({
    isActive: true,
    $or: [
      { role: 'Admin' },
      {
        permissions: {
          $elemMatch: {
            resource: resource,
            actions: action
          }
        }
      }
    ]
  }).select('-password -refreshTokens');
};

module.exports = mongoose.model('User', userSchema);