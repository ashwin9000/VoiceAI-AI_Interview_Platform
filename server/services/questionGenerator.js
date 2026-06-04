const { generateContent } = require('./geminiClient');
const { getQuestionGenerationPrompt } = require('../prompts/questionPrompt');

/**
 * Question Generator Service.
 * Uses Gemini AI to generate tailored interview questions
 * based on resume analysis and target role.
 */

/**
 * Generate interview questions using Gemini AI.
 * @param {Object} resumeAnalysis - Structured resume data from analyzeResume
 * @param {string} role - The target job role
 * @param {string} jobDescription - Optional job description text
 * @returns {Promise<Array>} Array of question objects with text, type, and difficulty
 */
const generateQuestions = async (resumeAnalysis, role, jobDescription) => {
  try {
    const prompt = getQuestionGenerationPrompt(
      resumeAnalysis,
      role,
      jobDescription
    );
    const questions = await generateContent(prompt);

    // Validate that we got an array
    if (!Array.isArray(questions)) {
      throw new Error('Expected an array of questions from Gemini');
    }

    // Ensure each question has required fields
    return questions.map((q) => ({
      text: q.text || '',
      type: q.type || 'technical',
      difficulty: q.difficulty || 'medium',
    }));
  } catch (error) {
    console.error('❌ Question generation failed:', error.message);
    throw new Error(`Question generation failed: ${error.message}`);
  }
};

module.exports = { generateQuestions };
