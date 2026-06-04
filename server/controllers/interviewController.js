const Interview = require('../models/Interview');
const Report = require('../models/Report');
const { extractText } = require('../utils/textExtractor');
const { analyzeResume } = require('../services/resumeAnalyzer');
const { generateQuestions } = require('../services/questionGenerator');
const { evaluateInterview } = require('../services/evaluationService');

/**
 * Interview Controller.
 * Handles interview lifecycle: start, list, get, answer, and complete.
 */

/**
 * @desc    Start a new interview session
 * @route   POST /api/interviews/start
 * @access  Private
 */
const startInterview = async (req, res, next) => {
  try {
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a role for the interview.',
      });
    }

    // Extract text from uploaded resume file
    let resumeText = '';
    let resumeUrl = '';
    if (req.files && req.files.resume && req.files.resume[0]) {
      const resumeFile = req.files.resume[0];
      resumeUrl = resumeFile.path;
      resumeText = await extractText(resumeFile.path, resumeFile.mimetype);
    }

    if (!resumeText) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a valid resume file (PDF or DOCX).',
      });
    }

    // Extract text from optional job description file
    let jobDescText = '';
    if (req.files && req.files.jobDescription && req.files.jobDescription[0]) {
      const jdFile = req.files.jobDescription[0];
      jobDescText = await extractText(jdFile.path, jdFile.mimetype);
    }

    // Analyze resume using Gemini AI
    const resumeAnalysis = await analyzeResume(resumeText);

    // Generate interview questions using Gemini AI
    const questions = await generateQuestions(resumeAnalysis, role, jobDescText);

    // Create interview document
    const interview = await Interview.create({
      userId: req.user._id,
      role,
      resumeUrl,
      resumeText,
      jobDescText,
      questions,
      status: 'in-progress',
    });

    res.status(201).json({
      success: true,
      data: {
        interview: {
          id: interview._id,
          role: interview.role,
          status: interview.status,
          createdAt: interview.createdAt,
        },
        questions: interview.questions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all interviews for the logged-in user
 * @route   GET /api/interviews
 * @access  Private
 */
const getInterviews = async (req, res, next) => {
  try {
    const interviews = await Interview.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('role status score duration createdAt');

    res.status(200).json({
      success: true,
      count: interviews.length,
      data: interviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single interview by ID
 * @route   GET /api/interviews/:id
 * @access  Private
 */
const getInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        error: 'Interview not found.',
      });
    }

    // Verify ownership — only the interview owner can access
    if (interview.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this interview.',
      });
    }

    res.status(200).json({
      success: true,
      data: interview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit an answer for a specific question
 * @route   PUT /api/interviews/:id/answer
 * @access  Private
 */
const submitAnswer = async (req, res, next) => {
  try {
    const { questionIndex, text } = req.body;

    if (questionIndex === undefined || !text) {
      return res.status(400).json({
        success: false,
        error: 'Please provide questionIndex and answer text.',
      });
    }

    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        error: 'Interview not found.',
      });
    }

    // Verify ownership
    if (interview.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this interview.',
      });
    }

    // Check interview is still in-progress
    if (interview.status !== 'in-progress') {
      return res.status(400).json({
        success: false,
        error: 'This interview has already been completed.',
      });
    }

    // Push the answer into the answers array
    interview.answers.push({
      questionIndex,
      text,
      timestamp: new Date(),
    });

    await interview.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Answer submitted successfully.',
        answersCount: interview.answers.length,
        totalQuestions: interview.questions.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Complete an interview and generate evaluation report
 * @route   POST /api/interviews/:id/complete
 * @access  Private
 */
const completeInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({
        success: false,
        error: 'Interview not found.',
      });
    }

    // Verify ownership
    if (interview.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this interview.',
      });
    }

    // Check interview is still in-progress
    if (interview.status === 'evaluated') {
      return res.status(400).json({
        success: false,
        error: 'This interview has already been evaluated.',
      });
    }

    // Evaluate the interview using Gemini AI
    const evaluation = await evaluateInterview(
      interview.resumeText,
      interview.questions,
      interview.answers,
      interview.role
    );

    // Create the report document
    const report = await Report.create({
      interviewId: interview._id,
      ...evaluation,
    });

    // Update interview status and score
    interview.status = 'evaluated';
    interview.score = evaluation.overallScore;
    if (req.body.duration) {
      interview.duration = req.body.duration;
    }
    await interview.save();

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startInterview,
  getInterviews,
  getInterview,
  submitAnswer,
  completeInterview,
};
