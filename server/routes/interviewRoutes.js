const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  startInterview,
  getInterviews,
  getInterview,
  submitAnswer,
  completeInterview,
} = require('../controllers/interviewController');

/**
 * Interview Routes
 * POST /api/interviews/start       - Start a new interview (upload resume + optional JD)
 * GET  /api/interviews             - Get all interviews for the user
 * GET  /api/interviews/:id         - Get a single interview by ID
 * PUT  /api/interviews/:id/answer  - Submit an answer for a question
 * POST /api/interviews/:id/complete - Complete interview and generate report
 */

// Start interview with file uploads (resume required, jobDescription optional)
router.post(
  '/start',
  auth,
  upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'jobDescription', maxCount: 1 },
  ]),
  startInterview
);

router.get('/', auth, getInterviews);
router.get('/:id', auth, getInterview);
router.put('/:id/answer', auth, submitAnswer);
router.post('/:id/complete', auth, completeInterview);

module.exports = router;
