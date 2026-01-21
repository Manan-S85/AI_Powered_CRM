const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const leadController = require('../controllers/lead.controller');
const { protect, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

// Lead validation rules
const leadValidationRules = {
  create: [
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
    body('phone')
      .optional()
      .matches(/^[\+]?[1-9][\d]{0,15}$/)
      .withMessage('Please provide a valid phone number'),
    body('company.name')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Company name cannot exceed 100 characters')
      .trim(),
    body('company.industry')
      .optional()
      .isIn(['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Real Estate', 'Consulting', 'Media', 'Other'])
      .withMessage('Invalid industry selection'),
    body('source')
      .notEmpty()
      .withMessage('Lead source is required')
      .isIn(['Website', 'Social Media', 'Google Forms', 'Email Campaign', 'Cold Call', 'Referral', 'Trade Show', 'Advertisement', 'Partner', 'Other'])
      .withMessage('Invalid lead source'),
    body('status')
      .optional()
      .isIn(['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'])
      .withMessage('Invalid status'),
    body('priority')
      .optional()
      .isIn(['Low', 'Medium', 'High', 'Critical'])
      .withMessage('Invalid priority level'),
    body('budget')
      .optional()
      .isIn(['<$10K', '$10K-$50K', '$50K-$100K', '$100K-$500K', '$500K+', 'Unknown'])
      .withMessage('Invalid budget range'),
    body('timeline')
      .optional()
      .isIn(['Immediate', '1-3 months', '3-6 months', '6-12 months', '12+ months', 'Unknown'])
      .withMessage('Invalid timeline'),
    body('notes')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Notes cannot exceed 2000 characters')
      .trim()
  ],
  
  update: [
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
    body('email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email')
      .normalizeEmail()
      .toLowerCase(),
    body('phone')
      .optional()
      .matches(/^[\+]?[1-9][\d]{0,15}$/)
      .withMessage('Please provide a valid phone number'),
    body('status')
      .optional()
      .isIn(['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'])
      .withMessage('Invalid status'),
    body('priority')
      .optional()
      .isIn(['Low', 'Medium', 'High', 'Critical'])
      .withMessage('Invalid priority level'),
    body('notes')
      .optional()
      .isLength({ max: 2000 })
      .withMessage('Notes cannot exceed 2000 characters')
      .trim()
  ],

  interaction: [
    body('type')
      .notEmpty()
      .withMessage('Interaction type is required')
      .isIn(['Call', 'Email', 'Meeting', 'Demo', 'Proposal', 'Follow-up'])
      .withMessage('Invalid interaction type'),
    body('notes')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Notes cannot exceed 1000 characters')
      .trim(),
    body('outcome')
      .optional()
      .isIn(['Positive', 'Neutral', 'Negative', 'No Response'])
      .withMessage('Invalid outcome'),
    body('nextAction')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Next action cannot exceed 200 characters')
      .trim(),
    body('scheduledDate')
      .optional()
      .isISO8601()
      .withMessage('Please provide a valid date')
  ]
};

// GET /api/leads - Get all leads with filtering, sorting, and pagination
router.get('/', 
  protect, 
  authorize('leads', 'read'),
  leadController.getLeads
);

// GET /api/leads/search - Search leads
router.get('/search', 
  protect, 
  authorize('leads', 'read'),
  leadController.searchLeads
);

// GET /api/leads/statistics - Get lead statistics
router.get('/statistics', 
  protect, 
  authorize('leads', 'read'),
  leadController.getLeadStatistics
);

// GET /api/leads/high-score - Get high-scoring leads
router.get('/high-score', 
  protect, 
  authorize('leads', 'read'),
  leadController.getHighScoreLeads
);

// GET /api/leads/overdue-followups - Get leads with overdue follow-ups
router.get('/overdue-followups', 
  protect, 
  authorize('leads', 'read'),
  leadController.getOverdueFollowUps
);

// GET /api/leads/export - Export leads to CSV/Excel
router.get('/export', 
  protect, 
  authorize('leads', 'export'),
  leadController.exportLeads
);

// POST /api/leads - Create a new lead
router.post('/', 
  protect, 
  authorize('leads', 'create'),
  leadValidationRules.create,
  validateRequest,
  leadController.createLead
);

// POST /api/leads/bulk - Bulk create leads
router.post('/bulk', 
  protect, 
  authorize('leads', 'create'),
  leadController.bulkCreateLeads
);

// GET /api/leads/:id - Get single lead by ID
router.get('/:id', 
  protect, 
  authorize('leads', 'read'),
  leadController.getLeadById
);

// PUT /api/leads/:id - Update lead by ID
router.put('/:id', 
  protect, 
  authorize('leads', 'update'),
  leadValidationRules.update,
  validateRequest,
  leadController.updateLead
);

// DELETE /api/leads/:id - Delete lead by ID
router.delete('/:id', 
  protect, 
  authorize('leads', 'delete'),
  leadController.deleteLead
);

// POST /api/leads/:id/interactions - Add interaction to lead
router.post('/:id/interactions', 
  protect, 
  authorize('leads', 'update'),
  leadValidationRules.interaction,
  validateRequest,
  leadController.addInteraction
);

// PUT /api/leads/:id/interactions/:interactionId - Update interaction
router.put('/:id/interactions/:interactionId', 
  protect, 
  authorize('leads', 'update'),
  leadValidationRules.interaction,
  validateRequest,
  leadController.updateInteraction
);

// DELETE /api/leads/:id/interactions/:interactionId - Delete interaction
router.delete('/:id/interactions/:interactionId', 
  protect, 
  authorize('leads', 'update'),
  leadController.deleteInteraction
);

// POST /api/leads/:id/score - Update lead score
router.post('/:id/score', 
  protect, 
  authorize('leads', 'update'),
  body('score')
    .isNumeric()
    .withMessage('Score must be a number')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),
  validateRequest,
  leadController.updateLeadScore
);

// PUT /api/leads/:id/assign - Assign lead to user
router.put('/:id/assign', 
  protect, 
  authorize('leads', 'update'),
  body('userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid User ID'),
  validateRequest,
  leadController.assignLead
);

// PUT /api/leads/:id/status - Update lead status
router.put('/:id/status', 
  protect, 
  authorize('leads', 'update'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'])
    .withMessage('Invalid status'),
  validateRequest,
  leadController.updateLeadStatus
);

// POST /api/leads/:id/tags - Add tags to lead
router.post('/:id/tags', 
  protect, 
  authorize('leads', 'update'),
  body('tags')
    .isArray({ min: 1 })
    .withMessage('Tags must be an array with at least one tag'),
  body('tags.*')
    .isString()
    .withMessage('Each tag must be a string')
    .isLength({ max: 30 })
    .withMessage('Each tag cannot exceed 30 characters')
    .trim(),
  validateRequest,
  leadController.addTags
);

// DELETE /api/leads/:id/tags - Remove tags from lead
router.delete('/:id/tags', 
  protect, 
  authorize('leads', 'update'),
  body('tags')
    .isArray({ min: 1 })
    .withMessage('Tags must be an array with at least one tag'),
  validateRequest,
  leadController.removeTags
);

module.exports = router;