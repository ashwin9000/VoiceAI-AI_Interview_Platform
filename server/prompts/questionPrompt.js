/**
 * Question Generation Prompt for Gemini AI.
 * Instructs the model to generate tailored interview questions
 * based on resume analysis, target role, and job description.
 */

/**
 * Generate a prompt for Gemini to create interview questions.
 * @param {Object} resumeAnalysis - Structured resume data from analyzeResume
 * @param {string} role - The target job role
 * @param {string} jobDescription - Optional job description text
 * @returns {string} The formatted prompt string
 */
const getQuestionGenerationPrompt = (resumeAnalysis, role, jobDescription) => {
  const jdSection = jobDescription
    ? `\nJOB DESCRIPTION:\n${jobDescription}`
    : '';

  return `You are an expert technical interviewer. Generate exactly 10 interview questions for a candidate applying for the role of "${role}".

CANDIDATE RESUME ANALYSIS:
${JSON.stringify(resumeAnalysis, null, 2)}
${jdSection}

Generate questions with the following distribution:
- 4 Technical questions (test specific technical skills relevant to the role and resume)
- 2 Conceptual questions (test understanding of core concepts and principles)
- 2 Behavioral questions (test soft skills, teamwork, problem-solving approach)
- 2 Resume-based questions (ask about specific projects, experiences, or claims in the resume)

Each question should have a difficulty level: "easy", "medium", or "hard".
Mix difficulties: 3 easy, 4 medium, 3 hard.

Return ONLY a valid JSON array with the following structure (no markdown, no code fences, no extra text):
[
  {
    "text": "The interview question text",
    "type": "technical",
    "difficulty": "medium"
  }
]

IMPORTANT:
- Return ONLY the JSON array, nothing else.
- Questions should be specific to the candidate's background and the target role.
- Technical questions should be relevant to the skills mentioned in the resume.
- Resume-based questions should reference specific projects or experiences.
- Each question should be clear and answerable in 2-3 minutes.`;
};

module.exports = { getQuestionGenerationPrompt };
