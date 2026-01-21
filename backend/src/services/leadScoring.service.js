/**
 * Lead Scoring Service
 * AI-powered lead scoring system for CRM
 * This service will integrate with machine learning models to calculate lead scores
 */

const logger = require('../utils/logger');
const axios = require('axios');

class LeadScoringService {
  constructor() {
    this.mlServiceUrl = process.env.ML_SERVICE_URL;
    this.mlApiKey = process.env.ML_API_KEY;
    this.defaultWeights = {
      demographic: 0.25,
      behavioral: 0.30,
      firmographic: 0.25,
      engagement: 0.20
    };
  }

  /**
   * Calculate lead score using AI/ML model
   * @param {Object} lead - Lead object from database
   * @returns {Object} - Score object with value and factors
   */
  async calculateLeadScore(lead) {
    try {
      // If ML service is available, use it for scoring
      if (this.mlServiceUrl && this.mlApiKey) {
        return await this.calculateScoreWithML(lead);
      }
      
      // Fallback to rule-based scoring
      return await this.calculateScoreWithRules(lead);
      
    } catch (error) {
      logger.error('Error calculating lead score:', error);
      
      // Return default score in case of error
      return {
        value: 50,
        factors: [{
          name: 'default',
          weight: 1.0,
          score: 50
        }]
      };
    }
  }

  /**
   * Calculate score using machine learning service
   * @param {Object} lead - Lead object
   * @returns {Object} - Score result from ML service
   */
  async calculateScoreWithML(lead) {
    try {
      const features = this.extractFeatures(lead);
      
      const response = await axios.post(
        `${this.mlServiceUrl}/predict/lead-score`,
        {
          features,
          lead_id: lead._id?.toString()
        },
        {
          headers: {
            'Authorization': `Bearer ${this.mlApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.score !== undefined) {
        return {
          value: Math.round(response.data.score),
          factors: response.data.factors || [],
          model_version: response.data.model_version,
          confidence: response.data.confidence
        };
      }

      // Fallback if ML service doesn't return expected format
      return await this.calculateScoreWithRules(lead);

    } catch (error) {
      logger.warn('ML service unavailable, falling back to rule-based scoring:', error.message);
      return await this.calculateScoreWithRules(lead);
    }
  }

  /**
   * Calculate score using rule-based system (fallback)
   * @param {Object} lead - Lead object
   * @returns {Object} - Score result from rules
   */
  async calculateScoreWithRules(lead) {
    try {
      const factors = [];
      let totalScore = 0;

      // Demographic scoring (25% weight)
      const demographicScore = this.scoreDemographics(lead);
      factors.push({
        name: 'demographic',
        weight: this.defaultWeights.demographic,
        score: demographicScore,
        details: 'Based on job title, company size, and industry'
      });
      totalScore += demographicScore * this.defaultWeights.demographic;

      // Behavioral scoring (30% weight)
      const behavioralScore = this.scoreBehavior(lead);
      factors.push({
        name: 'behavioral',
        weight: this.defaultWeights.behavioral,
        score: behavioralScore,
        details: 'Based on lead source, timeline, and budget'
      });
      totalScore += behavioralScore * this.defaultWeights.behavioral;

      // Firmographic scoring (25% weight)
      const firmographicScore = this.scoreFirmographics(lead);
      factors.push({
        name: 'firmographic',
        weight: this.defaultWeights.firmographic,
        score: firmographicScore,
        details: 'Based on company information and industry'
      });
      totalScore += firmographicScore * this.defaultWeights.firmographic;

      // Engagement scoring (20% weight)
      const engagementScore = this.scoreEngagement(lead);
      factors.push({
        name: 'engagement',
        weight: this.defaultWeights.engagement,
        score: engagementScore,
        details: 'Based on interactions and response rates'
      });
      totalScore += engagementScore * this.defaultWeights.engagement;

      return {
        value: Math.round(Math.max(0, Math.min(100, totalScore))),
        factors,
        method: 'rule-based'
      };

    } catch (error) {
      logger.error('Error in rule-based scoring:', error);
      throw error;
    }
  }

  /**
   * Score based on demographic factors
   * @param {Object} lead - Lead object
   * @returns {number} - Demographic score (0-100)
   */
  scoreDemographics(lead) {
    let score = 50; // Base score

    // Job title scoring
    if (lead.jobTitle) {
      const title = lead.jobTitle.toLowerCase();
      if (title.includes('ceo') || title.includes('founder') || title.includes('president')) {
        score += 20;
      } else if (title.includes('director') || title.includes('manager') || title.includes('head')) {
        score += 15;
      } else if (title.includes('vp') || title.includes('vice president')) {
        score += 18;
      }
    }

    // Decision maker bonus
    if (lead.decisionMaker) {
      score += 15;
    }

    // Company size scoring
    if (lead.company?.size) {
      switch (lead.company.size) {
        case '1000+':
          score += 15;
          break;
        case '201-1000':
          score += 12;
          break;
        case '51-200':
          score += 8;
          break;
        case '11-50':
          score += 5;
          break;
        default:
          score += 0;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score based on behavioral factors
   * @param {Object} lead - Lead object
   * @returns {number} - Behavioral score (0-100)
   */
  scoreBehavior(lead) {
    let score = 50; // Base score

    // Lead source scoring
    switch (lead.source) {
      case 'Referral':
        score += 20;
        break;
      case 'Website':
        score += 15;
        break;
      case 'Social Media':
        score += 10;
        break;
      case 'Email Campaign':
        score += 8;
        break;
      case 'Cold Call':
        score -= 5;
        break;
      default:
        score += 5;
    }

    // Timeline scoring
    switch (lead.timeline) {
      case 'Immediate':
        score += 25;
        break;
      case '1-3 months':
        score += 20;
        break;
      case '3-6 months':
        score += 10;
        break;
      case '6-12 months':
        score += 5;
        break;
      default:
        score -= 5;
    }

    // Budget scoring
    switch (lead.budget) {
      case '$500K+':
        score += 25;
        break;
      case '$100K-$500K':
        score += 20;
        break;
      case '$50K-$100K':
        score += 15;
        break;
      case '$10K-$50K':
        score += 10;
        break;
      case '<$10K':
        score += 5;
        break;
      default:
        score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score based on firmographic factors
   * @param {Object} lead - Lead object
   * @returns {number} - Firmographic score (0-100)
   */
  scoreFirmographics(lead) {
    let score = 50; // Base score

    // Industry scoring (some industries are better fits)
    if (lead.company?.industry) {
      switch (lead.company.industry) {
        case 'Technology':
          score += 15;
          break;
        case 'Healthcare':
          score += 12;
          break;
        case 'Finance':
          score += 12;
          break;
        case 'Education':
          score += 8;
          break;
        case 'Manufacturing':
          score += 8;
          break;
        default:
          score += 5;
      }
    }

    // Company revenue scoring
    if (lead.company?.revenue) {
      switch (lead.company.revenue) {
        case '$200M+':
          score += 20;
          break;
        case '$50M-$200M':
          score += 15;
          break;
        case '$10M-$50M':
          score += 10;
          break;
        case '$1M-$10M':
          score += 5;
          break;
        default:
          score += 0;
      }
    }

    // Company name presence (indicates established company)
    if (lead.company?.name && lead.company.name.length > 0) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Score based on engagement factors
   * @param {Object} lead - Lead object
   * @returns {number} - Engagement score (0-100)
   */
  scoreEngagement(lead) {
    let score = 50; // Base score

    // Interaction history scoring
    if (lead.interactions && lead.interactions.length > 0) {
      const interactionCount = lead.interactions.length;
      score += Math.min(20, interactionCount * 3); // Up to 20 points for interactions

      // Positive interaction outcomes
      const positiveInteractions = lead.interactions.filter(
        interaction => interaction.outcome === 'Positive'
      ).length;
      score += positiveInteractions * 5;

      // Recent interactions (within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentInteractions = lead.interactions.filter(
        interaction => new Date(interaction.date) >= thirtyDaysAgo
      ).length;
      score += recentInteractions * 3;
    }

    // Response rate to communications (if available)
    // This would require tracking email opens, clicks, etc.
    // For now, we'll use interaction responses as a proxy

    // Priority level as engagement indicator
    switch (lead.priority) {
      case 'Critical':
        score += 15;
        break;
      case 'High':
        score += 10;
        break;
      case 'Medium':
        score += 0;
        break;
      case 'Low':
        score -= 5;
        break;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Extract features for ML model
   * @param {Object} lead - Lead object
   * @returns {Object} - Feature vector for ML model
   */
  extractFeatures(lead) {
    return {
      // Demographic features
      has_job_title: !!lead.jobTitle,
      is_decision_maker: !!lead.decisionMaker,
      company_size_numeric: this.companySizeToNumeric(lead.company?.size),
      
      // Behavioral features
      source_score: this.sourceToScore(lead.source),
      timeline_urgency: this.timelineToUrgency(lead.timeline),
      budget_numeric: this.budgetToNumeric(lead.budget),
      
      // Firmographic features
      industry_score: this.industryToScore(lead.company?.industry),
      revenue_numeric: this.revenueToNumeric(lead.company?.revenue),
      has_company_name: !!(lead.company?.name),
      
      // Engagement features
      interaction_count: lead.interactions?.length || 0,
      positive_interactions: lead.interactions?.filter(i => i.outcome === 'Positive').length || 0,
      days_since_creation: this.daysSinceCreation(lead.createdAt),
      priority_numeric: this.priorityToNumeric(lead.priority),
      
      // Additional features
      has_phone: !!lead.phone,
      has_notes: !!(lead.notes && lead.notes.length > 0),
      tag_count: lead.tags?.length || 0
    };
  }

  // Helper methods for feature extraction
  companySizeToNumeric(size) {
    const sizeMap = {
      '1-10': 5,
      '11-50': 30,
      '51-200': 125,
      '201-1000': 600,
      '1000+': 5000
    };
    return sizeMap[size] || 0;
  }

  sourceToScore(source) {
    const sourceScores = {
      'Referral': 90,
      'Website': 75,
      'Social Media': 60,
      'Email Campaign': 55,
      'Trade Show': 65,
      'Advertisement': 45,
      'Cold Call': 30,
      'Partner': 70,
      'Other': 40
    };
    return sourceScores[source] || 40;
  }

  timelineToUrgency(timeline) {
    const urgencyMap = {
      'Immediate': 100,
      '1-3 months': 80,
      '3-6 months': 60,
      '6-12 months': 40,
      '12+ months': 20,
      'Unknown': 30
    };
    return urgencyMap[timeline] || 30;
  }

  budgetToNumeric(budget) {
    const budgetMap = {
      '<$10K': 5000,
      '$10K-$50K': 30000,
      '$50K-$100K': 75000,
      '$100K-$500K': 300000,
      '$500K+': 1000000,
      'Unknown': 0
    };
    return budgetMap[budget] || 0;
  }

  industryToScore(industry) {
    const industryScores = {
      'Technology': 85,
      'Healthcare': 75,
      'Finance': 75,
      'Education': 60,
      'Manufacturing': 60,
      'Retail': 55,
      'Real Estate': 50,
      'Consulting': 70,
      'Media': 55,
      'Other': 40
    };
    return industryScores[industry] || 40;
  }

  revenueToNumeric(revenue) {
    const revenueMap = {
      '<$1M': 500000,
      '$1M-$10M': 5000000,
      '$10M-$50M': 30000000,
      '$50M-$200M': 125000000,
      '$200M+': 500000000
    };
    return revenueMap[revenue] || 0;
  }

  priorityToNumeric(priority) {
    const priorityMap = {
      'Low': 25,
      'Medium': 50,
      'High': 75,
      'Critical': 100
    };
    return priorityMap[priority] || 50;
  }

  daysSinceCreation(createdAt) {
    if (!createdAt) return 0;
    const now = new Date();
    const created = new Date(createdAt);
    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
  }

  /**
   * Batch calculate scores for multiple leads
   * @param {Array} leads - Array of lead objects
   * @returns {Array} - Array of score results
   */
  async batchCalculateScores(leads) {
    try {
      if (this.mlServiceUrl && this.mlApiKey) {
        return await this.batchCalculateWithML(leads);
      }
      
      // Fallback to individual calculations
      const results = [];
      for (const lead of leads) {
        const score = await this.calculateScoreWithRules(lead);
        results.push({ leadId: lead._id, ...score });
      }
      return results;
      
    } catch (error) {
      logger.error('Error in batch score calculation:', error);
      throw error;
    }
  }

  /**
   * Batch calculate with ML service
   * @param {Array} leads - Array of lead objects
   * @returns {Array} - Array of score results
   */
  async batchCalculateWithML(leads) {
    try {
      const features = leads.map(lead => ({
        lead_id: lead._id?.toString(),
        features: this.extractFeatures(lead)
      }));

      const response = await axios.post(
        `${this.mlServiceUrl}/predict/batch-lead-score`,
        { leads: features },
        {
          headers: {
            'Authorization': `Bearer ${this.mlApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data.results || [];

    } catch (error) {
      logger.warn('ML batch service unavailable, falling back to individual calculations');
      throw error;
    }
  }

  /**
   * Get scoring insights for a lead
   * @param {Object} lead - Lead object
   * @returns {Object} - Scoring insights and recommendations
   */
  async getScoreInsights(lead) {
    try {
      const score = await this.calculateLeadScore(lead);
      const insights = {
        score: score.value,
        grade: this.getScoreGrade(score.value),
        factors: score.factors,
        recommendations: this.generateRecommendations(lead, score)
      };

      return insights;

    } catch (error) {
      logger.error('Error generating score insights:', error);
      throw error;
    }
  }

  /**
   * Convert numerical score to letter grade
   * @param {number} score - Numerical score
   * @returns {string} - Letter grade
   */
  getScoreGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  /**
   * Generate recommendations based on lead score and factors
   * @param {Object} lead - Lead object
   * @param {Object} score - Score object
   * @returns {Array} - Array of recommendations
   */
  generateRecommendations(lead, score) {
    const recommendations = [];

    if (score.value >= 80) {
      recommendations.push({
        type: 'priority',
        message: 'High-value lead - prioritize immediate contact',
        action: 'Schedule demo or meeting within 24 hours'
      });
    }

    if (!lead.decisionMaker) {
      recommendations.push({
        type: 'qualification',
        message: 'Identify decision maker',
        action: 'Ask about decision-making process and key stakeholders'
      });
    }

    if (!lead.timeline || lead.timeline === 'Unknown') {
      recommendations.push({
        type: 'qualification',
        message: 'Clarify timeline',
        action: 'Discover when they plan to make a decision'
      });
    }

    if (!lead.budget || lead.budget === 'Unknown') {
      recommendations.push({
        type: 'qualification',
        message: 'Understand budget range',
        action: 'Discuss budget parameters and expectations'
      });
    }

    if (lead.interactions?.length === 0) {
      recommendations.push({
        type: 'engagement',
        message: 'No interactions recorded',
        action: 'Initiate first contact and log interaction'
      });
    }

    return recommendations;
  }
}

module.exports = new LeadScoringService();