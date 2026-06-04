/**
 * Resume Analysis Prompt for Gemini AI.
 * Instructs the model to parse a resume and return structured JSON.
 */

/**
 * Generate a prompt for Gemini to analyze a resume.
 * @param {string} resumeText - Raw text extracted from the resume file
 * @returns {string} The formatted prompt string
 */
const getResumeAnalysisPrompt = (resumeText) => {
  return `You are an expert resume analyst. Analyze the following resume text and extract structured information.

RESUME TEXT:
${resumeText}

Return ONLY valid JSON with the following structure (no markdown, no code fences, no extra text):
{
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "Start - End",
      "highlights": ["highlight1", "highlight2"]
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "Brief description of the project",
      "technologies": ["tech1", "tech2"]
    }
  ],
  "education": ["Degree - Institution - Year"],
  "summary": "A concise professional summary of the candidate based on their resume"
}

IMPORTANT:
- Return ONLY the JSON object, nothing else.
- If a section has no data, use an empty array or empty string.
- Extract as much detail as possible from the resume.
- Skills should include both technical and soft skills mentioned.`;
};

module.exports = { getResumeAnalysisPrompt };
