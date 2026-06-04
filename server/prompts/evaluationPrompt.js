/**
 * Evaluation Prompt for Gemini AI.
 * Instructs the model to evaluate interview answers and produce
 * a comprehensive assessment report.
 */

/**
 * Generate a prompt for Gemini to evaluate interview answers.
 * @param {string} resumeText - Raw resume text for context
 * @param {Array} questions - Array of question objects
 * @param {Array} answers - Array of answer objects
 * @param {string} role - The target job role
 * @returns {string} The formatted prompt string
 */
const getEvaluationPrompt = (resumeText, questions, answers, role) => {
  // Build Q&A pairs for the prompt
  const qaPairs = questions
    .map((q, index) => {
      const answer = answers.find((a) => a.questionIndex === index);
      return `Q${index + 1} [${q.type}] [${q.difficulty}]: ${q.text}
Answer: ${answer ? answer.text : '(No answer provided)'}`;
    })
    .join('\n\n');

  return `You are an expert interview evaluator. Evaluate the following interview for the role of "${role}".

CANDIDATE RESUME:
${resumeText}

INTERVIEW Q&A:
${qaPairs}

Evaluate the candidate's performance thoroughly and return ONLY valid JSON with the following structure (no markdown, no code fences, no extra text):
{
  "overallScore": 75,
  "grade": "B+",
  "sectionScores": {
    "technical": 80,
    "communication": 70,
    "problemSolving": 75,
    "confidence": 65,
    "clarity": 72,
    "roleFit": 78
  },
  "strengths": [
    "Specific strength 1",
    "Specific strength 2"
  ],
  "weaknesses": [
    "Specific weakness 1",
    "Specific weakness 2"
  ],
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2"
  ],
  "learningResources": [
    {
      "topic": "Topic to study",
      "url": "https://relevant-resource-url.com"
    }
  ],
  "hiringRecommendation": "Hire",
  "feedback": "A detailed paragraph providing comprehensive feedback on the candidate's overall performance, highlighting key observations, notable responses, and areas that stood out during the interview."
}

SCORING GUIDELINES:
- overallScore: 0-100 based on overall interview performance
- grade: A+ (90-100), A (85-89), B+ (80-84), B (70-79), C+ (65-69), C (55-64), D (40-54), F (0-39)
- Each section score: 0-100
- hiringRecommendation: "Strong Hire" (85+), "Hire" (70-84), "Lean Hire" (55-69), "No Hire" (<55)
- Provide at least 3 strengths, 3 weaknesses, and 3 recommendations
- Provide at least 3 learning resources with real, relevant URLs
- Feedback should be a detailed paragraph (100+ words)

IMPORTANT:
- Return ONLY the JSON object, nothing else.
- Be fair but rigorous in evaluation.
- Consider the difficulty level of each question when scoring.
- If an answer was not provided, factor that into the score negatively.`;
};

module.exports = { getEvaluationPrompt };
