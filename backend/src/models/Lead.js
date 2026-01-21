const mongoose = require('mongoose');

/**
 * Lead Schema for CRM system
 * Represents potential customers with AI-powered scoring
 */
const leadSchema = new mongoose.Schema({
  // Contact Information
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
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },

  // Company Information
  company: {
    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters']
    },
    industry: {
      type: String,
      enum: [
        'Technology',
        'Healthcare',
        'Finance',
        'Education',
        'Retail',
        'Manufacturing',
        'Real Estate',
        'Consulting',
        'Media',
        'Other'
      ]
    },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-1000', '1000+']
    },
    revenue: {
      type: String,
      enum: ['<$1M', '$1M-$10M', '$10M-$50M', '$50M-$200M', '$200M+']
    }
  },

  // Lead Details
  source: {
    type: String,
    required: [true, 'Lead source is required'],
    enum: [
      'Website',
      'Social Media',
      'Google Forms',
      'Email Campaign',
      'Cold Call',
      'Referral',
      'Trade Show',
      'Advertisement',
      'Partner',
      'Other'
    ]
  },
  status: {
    type: String,
    default: 'New',
    enum: ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost']
  },
  priority: {
    type: String,
    default: 'Medium',
    enum: ['Low', 'Medium', 'High', 'Critical']
  },

  // AI-Powered Lead Scoring
  score: {
    value: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    lastCalculated: {
      type: Date,
      default: Date.now
    },
    factors: [{
      name: String,
      weight: Number,
      score: Number
    }]
  },

  // Lead Qualification
  budget: {
    type: String,
    enum: ['<$10K', '$10K-$50K', '$50K-$100K', '$100K-$500K', '$500K+', 'Unknown']
  },
  timeline: {
    type: String,
    enum: ['Immediate', '1-3 months', '3-6 months', '6-12 months', '12+ months', 'Unknown']
  },
  decisionMaker: {
    type: Boolean,
    default: false
  },

  // Interaction History
  interactions: [{
    type: {
      type: String,
      enum: ['Call', 'Email', 'Meeting', 'Demo', 'Proposal', 'Follow-up'],
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters']
    },
    outcome: {
      type: String,
      enum: ['Positive', 'Neutral', 'Negative', 'No Response']
    },
    nextAction: {
      type: String,
      maxlength: [200, 'Next action cannot exceed 200 characters']
    },
    scheduledDate: Date
  }],

  // Assignment and Tracking
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },

  // Additional Fields
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // Tracking
  lastContactDate: {
    type: Date
  },
  nextFollowUpDate: {
    type: Date
  },
  conversionDate: {
    type: Date
  },
  isConverted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
leadSchema.index({ email: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ 'score.value': -1 });
leadSchema.index({ source: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ nextFollowUpDate: 1 });

// Compound indexes
leadSchema.index({ status: 1, assignedTo: 1 });
leadSchema.index({ 'company.industry': 1, 'score.value': -1 });

// Virtual for full name
leadSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for days since creation
leadSchema.virtual('daysOld').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
leadSchema.pre('save', function(next) {
  // Update lastContactDate when adding interactions
  if (this.isModified('interactions') && this.interactions.length > 0) {
    const lastInteraction = this.interactions[this.interactions.length - 1];
    this.lastContactDate = lastInteraction.date;
  }

  // Mark as converted if status changes to "Closed Won"
  if (this.isModified('status') && this.status === 'Closed Won' && !this.isConverted) {
    this.isConverted = true;
    this.conversionDate = new Date();
  }

  next();
});

// Instance methods
leadSchema.methods.addInteraction = function(interactionData) {
  this.interactions.push(interactionData);
  this.lastContactDate = interactionData.date || new Date();
  return this.save();
};

leadSchema.methods.updateScore = function(newScore, factors = []) {
  this.score.value = newScore;
  this.score.lastCalculated = new Date();
  this.score.factors = factors;
  return this.save();
};

// Static methods
leadSchema.statics.getLeadsByScore = function(minScore = 0) {
  return this.find({ 'score.value': { $gte: minScore } })
    .sort({ 'score.value': -1 })
    .populate('assignedTo', 'firstName lastName email');
};

leadSchema.statics.getLeadsByStatus = function(status) {
  return this.find({ status })
    .populate('assignedTo', 'firstName lastName email')
    .sort({ createdAt: -1 });
};

leadSchema.statics.getOverdueFollowUps = function() {
  return this.find({
    nextFollowUpDate: { $lt: new Date() },
    status: { $nin: ['Closed Won', 'Closed Lost'] }
  })
  .populate('assignedTo', 'firstName lastName email')
  .sort({ nextFollowUpDate: 1 });
};

module.exports = mongoose.model('Lead', leadSchema);