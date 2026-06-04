const { generateContent } = require('./geminiClient');
const { getResumeAnalysisPrompt } = require('../prompts/resumePrompt');

/**
 * Resume Analyzer Service.
 * Uses Gemini AI to analyze resume text and extract structured data.
 */

/**
 * Analyze a resume using Gemini AI.
 * @param {string} resumeText - Raw text extracted from the resume file
 * @returns {Promise<Object>} Structured analysis with skills, experience, projects, education, summary
 */
const analyzeResume = async (resumeText) => {
  try {
    const prompt = getResumeAnalysisPrompt(resumeText);
    const analysis = await generateContent(prompt);

    // Ensure all expected fields exist with defaults
    return {
      skills: analysis.skills || [],
      experience: analysis.experience || [],
      projects: analysis.projects || [],
      education: analysis.education || [],
      summary: analysis.summary || '',
    };
  } catch (error) {
    console.error('❌ Resume analysis failed:', error.message);
    throw new Error(`Resume analysis failed: ${error.message}`);
  }
};

module.exports = { analyzeResume };
