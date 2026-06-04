const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getReport } = require('../controllers/reportController');

/**
 * Report Routes
 * GET /api/reports/:interviewId - Get report for a specific interview
 */

router.get('/:interviewId', auth, getReport);

module.exports = router;
