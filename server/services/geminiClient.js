const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Gemini AI Client.
 * Initializes the Google Generative AI SDK and provides a
 * reusable generateContent function with retry logic.
 */

// Initialize the Gemini client with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Create model instance using gemini-2.0-flash
const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

/**
 * Generate content using Gemini AI with retry logic.
 * Retries up to 3 times with exponential backoff on failure.
 *
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {Promise<Object>} Parsed JSON response from Gemini
 */
const generateContent = async (prompt) => {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      let text = response.text();

      // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
      text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      text = text.trim();

      // Parse and return the JSON content
      const parsed = JSON.parse(text);
      return parsed;
    } catch (error) {
      lastError = error;
      console.warn(
        `⚠️ Gemini attempt ${attempt}/${maxRetries} failed:`,
        error.message
      );

      // Don't wait after the last attempt
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  throw new Error(
    `Gemini API failed after ${maxRetries} attempts: ${lastError.message}`
  );
};

module.exports = { generateContent };
