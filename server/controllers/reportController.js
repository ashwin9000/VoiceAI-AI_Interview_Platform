const Report = require('../models/Report');
const Interview = require('../models/Interview');

/**
 * Report Controller.
 * Handles retrieval of interview evaluation reports.
 */

/**
 * @desc    Get report by interview ID
 * @route   GET /api/reports/:interviewId
 * @access  Private
 */
const getReport = async (req, res, next) => {
  try {
    const report = await Report.findOne({
      interviewId: req.params.interviewId,
    }).populate('interviewId', 'role status score duration createdAt');

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found for this interview.',
      });
    }

    // Verify ownership — find the interview and check the userId
    const interview = await Interview.findById(req.params.interviewId);
    if (!interview) {
      return res.status(404).json({
        success: false,
        error: 'Associated interview not found.',
      });
    }

    if (interview.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this report.',
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getReport };
