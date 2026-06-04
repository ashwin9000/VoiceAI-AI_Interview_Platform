const mongoose = require('mongoose');

/**
 * Interview Schema
 * Tracks an entire interview session: questions generated, answers submitted,
 * scoring, and current status.
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
  questions: [
    {
      text: { type: String },
      type: { type: String },
      difficulty: { type: String },
    },
  ],
  answers: [
    {
      questionIndex: { type: Number },
      text: { type: String },
      timestamp: { type: Date, default: Date.now },
    },
  ],
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
