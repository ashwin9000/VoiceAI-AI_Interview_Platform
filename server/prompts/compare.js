require("dotenv").config({
  path: "../.env"
});

const fs = require("fs");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Resume Analysis Prompt
 */
function getResumeAnalysisPrompt(resumeText) {
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
}

/**
 * Gemini
 */
async function analyzeWithGemini(resumeText) {
  try {
    const genAI = new GoogleGenerativeAI(
      process.env.GEMINI_API_KEY
    );

    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
    });

    const start = Date.now();

    const result = await model.generateContent(
      getResumeAnalysisPrompt(resumeText)
    );

    const elapsed = Date.now() - start;

    const text = result.response.text();

    return {
      success: true,
      latency: elapsed,
      raw: text,
      parsed: JSON.parse(text),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Llama Server
 */
async function analyzeWithLlama(resumeText) {
  try {
    const start = Date.now();

    const response = await axios.post(
    "http://localhost:8080/v1/chat/completions",
    {
        messages: [
        {
            role: "system",
            content:
            "You are a resume parsing engine that outputs only valid JSON."
        },
        {
            role: "user",
            content: getResumeAnalysisPrompt(resumeText)
        }
        ],

        temperature: 0,
        top_p: 0.9,

        response_format: {
        type: "json_schema",
        json_schema: {
            name: "resume_schema",
            schema: {
            type: "object",

            properties: {
                skills: {
                type: "array",
                items: {
                    type: "string"
                }
                },

                experience: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                    company: {
                        type: "string"
                    },
                    role: {
                        type: "string"
                    },
                    duration: {
                        type: "string"
                    },
                    highlights: {
                        type: "array",
                        items: {
                        type: "string"
                        }
                    }
                    },
                    required: [
                    "company",
                    "role",
                    "duration",
                    "highlights"
                    ]
                }
                },

                projects: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                    name: {
                        type: "string"
                    },
                    description: {
                        type: "string"
                    },
                    technologies: {
                        type: "array",
                        items: {
                        type: "string"
                        }
                    }
                    },
                    required: [
                    "name",
                    "description",
                    "technologies"
                    ]
                }
                },

                education: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                    degree: {
                        type: "string"
                    },
                    institution: {
                        type: "string"
                    },
                    year: {
                        type: "string"
                    }
                    },
                    required: [
                    "degree",
                    "institution",
                    "year"
                    ]
                }
                },

                summary: {
                type: "string"
                }
            },

            required: [
                "skills",
                "experience",
                "projects",
                "education",
                "summary"
            ]
            }
        }
        }
    }
    );

    const elapsed = Date.now() - start;

    const text =
      response.data.choices[0].message.content;

    return {
      success: true,
      latency: elapsed,
      raw: text,
      parsed: JSON.parse(text),
    };
  } catch (error) {
    return {
      success: false,
      error:
        error.response?.data ||
        error.message,
    };
  }
}

/**
 * Main
 */
async function main() {
  try {
    // Replace with your resume text file
    const resumeText = fs.readFileSync(
      "./resume.txt",
      "utf8"
    );

    console.log(
      "\n======================================"
    );
    console.log("TESTING GEMINI");
    console.log(
      "======================================\n"
    );

    const gemini = await analyzeWithGemini(
      resumeText
    );

    if (gemini.success) {
      console.log(
        `Latency: ${gemini.latency} ms\n`
      );
      console.dir(gemini.parsed, {
        depth: null,
      });
    } else {
      console.error(
        "Gemini Error:",
        gemini.error
      );
    }

    console.log(
      "\n======================================"
    );
    console.log("TESTING LLAMA");
    console.log(
      "======================================\n"
    );

    const llama = await analyzeWithLlama(
      resumeText
    );

    if (llama.success) {
      console.log(
        `Latency: ${llama.latency} ms\n`
      );
      console.dir(llama.parsed, {
        depth: null,
      });
    } else {
      console.error(
        "Llama Error:",
        llama.error
      );
    }

    console.log(
      "\n======================================"
    );
    console.log("SUMMARY");
    console.log(
      "======================================\n"
    );

    console.log("Gemini:");
    console.log(
      gemini.success
        ? `✓ Success (${gemini.latency} ms)`
        : "✗ Failed"
    );

    console.log("Llama:");
    console.log(
      llama.success
        ? `✓ Success (${llama.latency} ms)`
        : "✗ Failed"
    );
  } catch (err) {
    console.error(err);
  }
}

main();