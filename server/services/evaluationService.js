const { generateContent } = require('./geminiClient');
const { getEvaluationPrompt } = require('../prompts/evaluationPrompt');

/**
 * Evaluation Service.
 * Uses Gemini AI to evaluate interview answers and produce
 * a comprehensive assessment report.
 */

/**
 * Calculate grade from overall score if not provided by Gemini.
 * @param {number} score - Overall score (0-100)
 * @returns {string} Letter grade
 */
const calculateGrade = (score) => {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'C+';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
};

/**
 * Evaluate an interview using Gemini AI.
 * @param {string} resumeText - Raw resume text for context
 * @param {Array} questions - Array of question objects
 * @param {Array} answers - Array of answer objects
 * @param {string} role - The target job role
 * @returns {Promise<Object>} Structured evaluation with scores, feedback, and recommendations
 */
const evaluateInterview = async (resumeText, questions, answers, role) => {
  try {
    const prompt = getEvaluationPrompt(resumeText, questions, answers, role);
    const evaluation = await generateContent(prompt);

    // Ensure grade is calculated if not provided
    const overallScore = evaluation.overallScore || 0;
    const grade = evaluation.grade || calculateGrade(overallScore);

    // Return structured evaluation with defaults for missing fields
    return {
      overallScore,
      grade,
      sectionScores: {
        technical: evaluation.sectionScores?.technical || 0,
        communication: evaluation.sectionScores?.communication || 0,
        problemSolving: evaluation.sectionScores?.problemSolving || 0,
        confidence: evaluation.sectionScores?.confidence || 0,
        clarity: evaluation.sectionScores?.clarity || 0,
        roleFit: evaluation.sectionScores?.roleFit || 0,
      },
      strengths: evaluation.strengths || [],
      weaknesses: evaluation.weaknesses || [],
      recommendations: evaluation.recommendations || [],
      learningResources: evaluation.learningResources || [],
      hiringRecommendation: evaluation.hiringRecommendation || 'No Hire',
      feedback: evaluation.feedback || '',
    };
  } catch (error) {
    console.error('❌ Interview evaluation failed:', error.message);
    throw new Error(`Interview evaluation failed: ${error.message}`);
  }
};

module.exports = { evaluateInterview };
