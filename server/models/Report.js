const mongoose = require('mongoose');

/**
 * Report Schema
 * Stores detailed evaluation results for a completed interview.
 * Each interview has exactly one report (enforced by unique constraint).
 */
const reportSchema = new mongoose.Schema({
  interviewId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Interview',
    required: [true, 'Interview ID is required'],
    unique: true,
  },
  overallScore: {
    type: Number,
    default: 0,
  },
  grade: {
    type: String,
  },
  sectionScores: {
    technical: { type: Number, default: 0 },
    communication: { type: Number, default: 0 },
    problemSolving: { type: Number, default: 0 },
    confidence: { type: Number, default: 0 },
    clarity: { type: Number, default: 0 },
    roleFit: { type: Number, default: 0 },
  },
  strengths: [String],
  weaknesses: [String],
  recommendations: [String],
  learningResources: [
    {
      topic: { type: String },
      url: { type: String },
    },
  ],
  hiringRecommendation: {
    type: String,
  },
  feedback: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Report', reportSchema);
