const { generateContentWithLlama } = require('./llamaClient');
const { generateContent } = require('./geminiClient');
const { getResumeAnalysisPrompt } = require('../prompts/resumePrompt');

/**
 * Resume Analyzer Service.
 * Uses Llama.cpp (Qwen) as the primary extraction engine.
 * Falls back to Gemini AI if Llama fails, is unavailable,
 * or returns invalid/incomplete data.
 */

/**
 * Validate that the extracted resume data has the expected structure
 * and contains meaningful content.
 *
 * @param {*} data - The parsed extraction result to validate
 * @returns {{ valid: boolean, reason?: string }}
 */
const validateResumeAnalysis = (data) => {
  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'Response is not an object' };
  }

  if (!Array.isArray(data.skills)) {
    return { valid: false, reason: 'Missing or invalid "skills" array' };
  }

  if (data.skills.length === 0) {
    return { valid: false, reason: 'Extracted zero skills — likely a parsing failure' };
  }

  if (!Array.isArray(data.experience)) {
    return { valid: false, reason: 'Missing or invalid "experience" array' };
  }

  if (!Array.isArray(data.projects)) {
    return { valid: false, reason: 'Missing or invalid "projects" array' };
  }

  if (!Array.isArray(data.education)) {
    return { valid: false, reason: 'Missing or invalid "education" array' };
  }

  return { valid: true };
};

/**
 * Normalize the extraction result to ensure all expected fields
 * exist with safe defaults.
 *
 * @param {Object} data - Raw parsed extraction result
 * @returns {Object} Normalized resume analysis
 */
const normalizeAnalysis = (data) => ({
  skills: data.skills || [],
  experience: data.experience || [],
  projects: data.projects || [],
  education: data.education || [],
  summary: data.summary || '',
});

/**
 * Analyze a resume using Llama.cpp (primary) with Gemini fallback.
 *
 * Flow:
 *   1. Try Llama.cpp extraction with JSON schema enforcement
 *   2. Validate the result has meaningful content
 *   3. On any failure → fall back to Gemini with retry logic
 *
 * @param {string} resumeText - Raw text extracted from the resume file
 * @returns {Promise<Object>} Structured analysis with skills, experience, projects, education, summary
 */
const analyzeResume = async (resumeText) => {
  const prompt = getResumeAnalysisPrompt(resumeText);

  // ── Attempt 1: Llama.cpp (primary) ──────────────────────────────
  try {
    console.log('🦙 Attempting resume extraction via Llama.cpp...');

    const llamaResult = await generateContentWithLlama(prompt);

    const validation = validateResumeAnalysis(llamaResult);

    if (validation.valid) {
      console.log('✅ Resume extracted via Llama.cpp (primary)');
      return normalizeAnalysis(llamaResult);
    }

    // Llama returned structurally valid JSON but with useless content
    console.warn(
      `⚠️ Llama extraction returned invalid data: ${validation.reason}. Falling back to Gemini...`
    );
  } catch (llamaError) {
    // Network error, timeout, JSON parse failure, etc.
    const reason =
      llamaError.code === 'ECONNREFUSED'
        ? 'Llama server is not running'
        : llamaError.code === 'ECONNABORTED'
          ? 'Llama server timed out'
          : llamaError.message;

    console.warn(
      `⚠️ Llama extraction failed: ${reason}. Falling back to Gemini...`
    );
  }

  // ── Attempt 2: Gemini (fallback) ────────────────────────────────
  try {
    console.log('🔄 Attempting resume extraction via Gemini (fallback)...');

    const geminiResult = await generateContent(prompt);

    const validation = validateResumeAnalysis(geminiResult);

    if (!validation.valid) {
      throw new Error(
        `Gemini fallback also returned invalid data: ${validation.reason}`
      );
    }

    console.log('✅ Resume extracted via Gemini (fallback)');
    return normalizeAnalysis(geminiResult);
  } catch (geminiError) {
    console.error('❌ Both Llama and Gemini extraction failed:', geminiError.message);
    throw new Error(`Resume analysis failed: ${geminiError.message}`);
  }
};

module.exports = { analyzeResume };
