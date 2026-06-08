/**
 * Resume Analysis Prompt.
 * Instructs the model to parse a resume and return structured JSON.
 *
 * Upgraded from the battle-tested prompt in server/prompts/compare.js
 * with explicit rules, few-shot examples, and strict output constraints.
 */

/**
 * Generate a prompt to analyze a resume and extract structured data.
 * @param {string} resumeText - Raw text extracted from the resume file
 * @returns {string} The formatted prompt string
 */
const getResumeAnalysisPrompt = (resumeText) => {
  return `
You are an expert resume parser.

Your task is to extract structured information from resumes.

IMPORTANT RULES:

- Return ONLY valid JSON.
- Do NOT return markdown.
- Do NOT return explanations.
- Do NOT invent information.
- Skills must be individual technologies, tools, languages, frameworks, or soft skills.
- Do NOT return skill categories such as "Programming Languages" or "Web Technologies".
- Education must NEVER be placed inside experience.
- Experience must only contain actual jobs, internships, freelancing, or professional work.
- Projects are not experience.
- If information is missing, use empty arrays.

Example 1:

Resume:

John Doe

Software Engineer Intern
Google
May 2024 - Aug 2024

Skills:
Python, Java, Docker

Education:
B.Tech CSE
ABC University
2021-2025

Output:

{
  "skills": ["Python", "Java", "Docker"],
  "experience": [
    {
      "company": "Google",
      "role": "Software Engineer Intern",
      "duration": "May 2024 - Aug 2024",
      "highlights": []
    }
  ],
  "projects": [],
  "education": [
    {
      "degree": "B.Tech CSE",
      "institution": "ABC University",
      "year": "2021-2025"
    }
  ],
  "summary": ""
}

Example 2:

Resume:

Jane Smith

Skills:
React
Node.js
MongoDB

Project:
Task Manager

Built a full-stack task management application.

Output:

{
  "skills": ["React", "Node.js", "MongoDB"],
  "experience": [],
  "projects": [
    {
      "name": "Task Manager",
      "description": "Built a full-stack task management application.",
      "technologies": ["React", "Node.js", "MongoDB"]
    }
  ],
  "education": [],
  "summary": ""
}

Now parse the following resume:

${resumeText}

Return ONLY JSON.
`;
};

module.exports = { getResumeAnalysisPrompt };
