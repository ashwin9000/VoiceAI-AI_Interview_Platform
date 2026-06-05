const mongoose = require('mongoose');

/**
 * Interview Schema
 * Tracks an entire interview session: questions generated dynamically,
 * answers submitted, scoring, and current status.
 *
 * Questions are generated one at a time based on conversation history.
 * The questionState sub-document tracks progress through interview phases.
 */
const interviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  role: {
    type: String,
    required: [true, 'Role is required'],
  },
  resumeUrl: {
    type: String,
  },
  resumeText: {
    type: String,
  },
  jobDescText: {
    type: String,
  },
  /**
   * Structured resume analysis from Gemini.
   * Stored once at interview start so we don't re-analyze on each turn.
   */
  resumeAnalysis: {
    type: mongoose.Schema.Types.Mixed,
  },
  questions: [
    {
      text: { type: String },
      type: { type: String },
      difficulty: { type: String },
      isFollowUp: { type: Boolean, default: false },
      parentQuestionIndex: { type: Number, default: null },
    },
  ],
  answers: [
    {
      questionIndex: { type: Number },
      text: { type: String },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  /**
   * Tracks dynamic question generation state.
   * Used to determine which phase we're in and what to ask next.
   */
  questionState: {
    resumeQuestionsAsked: { type: Number, default: 0 },
    technicalAsked: { type: Number, default: 0 },
    conceptualAsked: { type: Number, default: 0 },
    behavioralAsked: { type: Number, default: 0 },
    currentFollowUpCount: { type: Number, default: 0 },
    currentResumeTopics: { type: [String], default: [] },
    interviewPhase: {
      type: String,
      enum: ['resume', 'technical', 'conceptual', 'behavioral', 'complete'],
      default: 'resume',
    },
  },
  score: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'evaluated'],
    default: 'in-progress',
  },
  duration: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient querying of user interviews by date
interviewSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Interview', interviewSchema);
