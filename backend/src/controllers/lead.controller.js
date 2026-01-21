const Lead = require('../models/Lead');
const User = require('../models/User');
const leadScoringService = require('../services/leadScoring.service');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

/**
 * Lead Controller
 * Handles all lead-related operations
 */
class LeadController {
  
  /**
   * @desc    Get all leads with filtering, sorting, and pagination
   * @route   GET /api/leads
   * @access  Private
   */
  async getLeads(req, res) {
    try {
      const {
        page = 1,
        limit = 25,
        status,
        source,
        priority,
        assignedTo,
        minScore,
        maxScore,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search
      } = req.query;

      // Build filter object
      const filter = {};

      if (status) filter.status = status;
      if (source) filter.source = source;
      if (priority) filter.priority = priority;
      if (assignedTo) filter.assignedTo = assignedTo;
      if (minScore || maxScore) {
        filter['score.value'] = {};
        if (minScore) filter['score.value'].$gte = parseInt(minScore);
        if (maxScore) filter['score.value'].$lte = parseInt(maxScore);
      }

      // Date range filter
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }

      // Search functionality
      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'company.name': { $regex: search, $options: 'i' } }
        ];
      }

      // If user is not admin/manager, show only assigned leads
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        filter.assignedTo = req.user._id;
      }

      // Build sort object
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [leads, totalLeads] = await Promise.all([
        Lead.find(filter)
          .populate('assignedTo', 'firstName lastName email')
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Lead.countDocuments(filter)
      ]);

      const totalPages = Math.ceil(totalLeads / parseInt(limit));

      res.status(200).json({
        success: true,
        data: leads,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalLeads,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1
        }
      });

      logger.info(`Retrieved ${leads.length} leads for user ${req.user.email}`);

    } catch (error) {
      logger.error('Error fetching leads:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching leads',
        error: error.message
      });
    }
  }

  /**
   * @desc    Search leads by text
   * @route   GET /api/leads/search
   * @access  Private
   */
  async searchLeads(req, res) {
    try {
      const { q, limit = 10 } = req.query;

      if (!q || q.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search query must be at least 2 characters long'
        });
      }

      const searchFilter = {
        $or: [
          { firstName: { $regex: q, $options: 'i' } },
          { lastName: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { 'company.name': { $regex: q, $options: 'i' } },
          { phone: { $regex: q, $options: 'i' } }
        ]
      };

      // Restrict access for non-admin users
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        searchFilter.assignedTo = req.user._id;
      }

      const leads = await Lead.find(searchFilter)
        .populate('assignedTo', 'firstName lastName')
        .limit(parseInt(limit))
        .sort({ 'score.value': -1 })
        .lean();

      res.status(200).json({
        success: true,
        data: leads,
        count: leads.length
      });

    } catch (error) {
      logger.error('Error searching leads:', error);
      res.status(500).json({
        success: false,
        message: 'Error searching leads',
        error: error.message
      });
    }
  }

  /**
   * @desc    Get lead statistics
   * @route   GET /api/leads/statistics
   * @access  Private
   */
  async getLeadStatistics(req, res) {
    try {
      const filter = {};
      
      // Restrict access for non-admin users
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        filter.assignedTo = req.user._id;
      }

      const stats = await Lead.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalLeads: { $sum: 1 },
            avgScore: { $avg: '$score.value' },
            totalConverted: { $sum: { $cond: [{ $eq: ['$isConverted', true] }, 1, 0] } },
            statusBreakdown: {
              $push: '$status'
            },
            sourceBreakdown: {
              $push: '$source'
            }
          }
        }
      ]);

      // Count by status
      const statusCounts = await Lead.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Count by source
      const sourceCounts = await Lead.aggregate([
        { $match: filter },
        { $group: { _id: '$source', count: { $sum: 1 } } }
      ]);

      const result = {
        totalLeads: stats[0]?.totalLeads || 0,
        averageScore: Math.round(stats[0]?.avgScore || 0),
        totalConverted: stats[0]?.totalConverted || 0,
        conversionRate: stats[0]?.totalLeads > 0 
          ? Math.round((stats[0]?.totalConverted / stats[0]?.totalLeads) * 100) 
          : 0,
        statusBreakdown: statusCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
        sourceBreakdown: sourceCounts.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      };

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error fetching lead statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching statistics',
        error: error.message
      });
    }
  }

  /**
   * @desc    Get high-scoring leads
   * @route   GET /api/leads/high-score
   * @access  Private
   */
  async getHighScoreLeads(req, res) {
    try {
      const { minScore = 70, limit = 20 } = req.query;

      const filter = { 'score.value': { $gte: parseInt(minScore) } };
      
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        filter.assignedTo = req.user._id;
      }

      const leads = await Lead.find(filter)
        .populate('assignedTo', 'firstName lastName email')
        .sort({ 'score.value': -1 })
        .limit(parseInt(limit))
        .lean();

      res.status(200).json({
        success: true,
        data: leads,
        count: leads.length
      });

    } catch (error) {
      logger.error('Error fetching high-score leads:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching high-score leads',
        error: error.message
      });
    }
  }

  /**
   * @desc    Get overdue follow-ups
   * @route   GET /api/leads/overdue-followups
   * @access  Private
   */
  async getOverdueFollowUps(req, res) {
    try {
      const filter = {
        nextFollowUpDate: { $lt: new Date() },
        status: { $nin: ['Closed Won', 'Closed Lost'] }
      };
      
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        filter.assignedTo = req.user._id;
      }

      const leads = await Lead.find(filter)
        .populate('assignedTo', 'firstName lastName email')
        .sort({ nextFollowUpDate: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: leads,
        count: leads.length
      });

    } catch (error) {
      logger.error('Error fetching overdue follow-ups:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching overdue follow-ups',
        error: error.message
      });
    }
  }

  /**
   * @desc    Create new lead
   * @route   POST /api/leads
   * @access  Private
   */
  async createLead(req, res) {
    try {
      // Check if lead with email already exists
      const existingLead = await Lead.findOne({ email: req.body.email });
      if (existingLead) {
        return res.status(400).json({
          success: false,
          message: 'Lead with this email already exists'
        });
      }

      // Create lead
      const leadData = {
        ...req.body,
        assignedTo: req.body.assignedTo || req.user._id
      };

      const lead = await Lead.create(leadData);

      // Calculate initial lead score
      try {
        const score = await leadScoringService.calculateLeadScore(lead);
        await lead.updateScore(score.value, score.factors);
      } catch (scoreError) {
        logger.warn('Failed to calculate initial lead score:', scoreError.message);
      }

      await lead.populate('assignedTo', 'firstName lastName email');

      res.status(201).json({
        success: true,
        data: lead,
        message: 'Lead created successfully'
      });

      logger.info(`New lead created: ${lead.email} by user ${req.user.email}`);

    } catch (error) {
      logger.error('Error creating lead:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Lead with this email already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error creating lead',
        error: error.message
      });
    }
  }

  /**
   * @desc    Get single lead by ID
   * @route   GET /api/leads/:id
   * @access  Private
   */
  async getLeadById(req, res) {
    try {
      const filter = { _id: req.params.id };
      
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        filter.assignedTo = req.user._id;
      }

      const lead = await Lead.findOne(filter)
        .populate('assignedTo', 'firstName lastName email')
        .lean();

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      res.status(200).json({
        success: true,
        data: lead
      });

    } catch (error) {
      logger.error('Error fetching lead:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching lead',
        error: error.message
      });
    }
  }

  /**
   * @desc    Update lead
   * @route   PUT /api/leads/:id
   * @access  Private
   */
  async updateLead(req, res) {
    try {
      const filter = { _id: req.params.id };
      
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        filter.assignedTo = req.user._id;
      }

      const lead = await Lead.findOne(filter);

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      // Update lead
      Object.assign(lead, req.body);
      await lead.save();

      // Recalculate score if significant fields changed
      const scoreRelevantFields = ['status', 'company', 'budget', 'timeline', 'decisionMaker'];
      const changedFields = Object.keys(req.body);
      
      if (scoreRelevantFields.some(field => changedFields.includes(field))) {
        try {
          const score = await leadScoringService.calculateLeadScore(lead);
          await lead.updateScore(score.value, score.factors);
        } catch (scoreError) {
          logger.warn('Failed to recalculate lead score:', scoreError.message);
        }
      }

      await lead.populate('assignedTo', 'firstName lastName email');

      res.status(200).json({
        success: true,
        data: lead,
        message: 'Lead updated successfully'
      });

      logger.info(`Lead updated: ${lead.email} by user ${req.user.email}`);

    } catch (error) {
      logger.error('Error updating lead:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating lead',
        error: error.message
      });
    }
  }

  /**
   * @desc    Delete lead
   * @route   DELETE /api/leads/:id
   * @access  Private
   */
  async deleteLead(req, res) {
    try {
      const filter = { _id: req.params.id };
      
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        filter.assignedTo = req.user._id;
      }

      const lead = await Lead.findOne(filter);

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      await Lead.deleteOne({ _id: req.params.id });

      res.status(200).json({
        success: true,
        message: 'Lead deleted successfully'
      });

      logger.info(`Lead deleted: ${lead.email} by user ${req.user.email}`);

    } catch (error) {
      logger.error('Error deleting lead:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting lead',
        error: error.message
      });
    }
  }

  /**
   * @desc    Add interaction to lead
   * @route   POST /api/leads/:id/interactions
   * @access  Private
   */
  async addInteraction(req, res) {
    try {
      const filter = { _id: req.params.id };
      
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        filter.assignedTo = req.user._id;
      }

      const lead = await Lead.findOne(filter);

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      const interactionData = {
        ...req.body,
        date: req.body.date || new Date()
      };

      await lead.addInteraction(interactionData);
      await lead.populate('assignedTo', 'firstName lastName email');

      res.status(200).json({
        success: true,
        data: lead,
        message: 'Interaction added successfully'
      });

      logger.info(`Interaction added to lead ${lead.email} by user ${req.user.email}`);

    } catch (error) {
      logger.error('Error adding interaction:', error);
      res.status(500).json({
        success: false,
        message: 'Error adding interaction',
        error: error.message
      });
    }
  }

  /**
   * @desc    Update lead score
   * @route   POST /api/leads/:id/score
   * @access  Private
   */
  async updateLeadScore(req, res) {
    try {
      const { score, factors } = req.body;

      const filter = { _id: req.params.id };
      
      if (!['Admin', 'Manager'].includes(req.user.role)) {
        filter.assignedTo = req.user._id;
      }

      const lead = await Lead.findOne(filter);

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      await lead.updateScore(score, factors);
      await lead.populate('assignedTo', 'firstName lastName email');

      res.status(200).json({
        success: true,
        data: lead,
        message: 'Lead score updated successfully'
      });

      logger.info(`Lead score updated for ${lead.email} by user ${req.user.email}`);

    } catch (error) {
      logger.error('Error updating lead score:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating lead score',
        error: error.message
      });
    }
  }

  // Additional methods for bulk operations, export, etc.
  async bulkCreateLeads(req, res) {
    // Implementation for bulk lead creation
    res.status(501).json({ message: 'Bulk create not implemented yet' });
  }

  async exportLeads(req, res) {
    // Implementation for lead export
    res.status(501).json({ message: 'Export not implemented yet' });
  }

  async updateInteraction(req, res) {
    // Implementation for updating interactions
    res.status(501).json({ message: 'Update interaction not implemented yet' });
  }

  async deleteInteraction(req, res) {
    // Implementation for deleting interactions
    res.status(501).json({ message: 'Delete interaction not implemented yet' });
  }

  async assignLead(req, res) {
    // Implementation for assigning leads
    res.status(501).json({ message: 'Assign lead not implemented yet' });
  }

  async updateLeadStatus(req, res) {
    // Implementation for updating lead status
    res.status(501).json({ message: 'Update status not implemented yet' });
  }

  async addTags(req, res) {
    // Implementation for adding tags
    res.status(501).json({ message: 'Add tags not implemented yet' });
  }

  async removeTags(req, res) {
    // Implementation for removing tags
    res.status(501).json({ message: 'Remove tags not implemented yet' });
  }
}

module.exports = new LeadController();