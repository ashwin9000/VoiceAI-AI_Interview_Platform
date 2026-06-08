const axios = require('axios');

/**
 * Llama.cpp Client (Qwen model via OpenAI-compatible API).
 * Provides a generateContent function with structured JSON output
 * enforcement via json_schema response_format.
 *
 * Reference: server/prompts/compare.js (analyzeWithLlama)
 */

const LLAMA_SERVER_URL =
  process.env.LLAMA_SERVER_URL || 'http://localhost:8080';

const LLAMA_TIMEOUT_MS = 60000; // 60s timeout for slow local models

/**
 * JSON schema enforced on the Llama server for resume extraction.
 * Guarantees the response matches the exact structure the app expects.
 */
const RESUME_JSON_SCHEMA = {
  name: 'resume_schema',
  schema: {
    type: 'object',

    properties: {
      skills: {
        type: 'array',
        items: {
          type: 'string',
        },
      },

      experience: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            company: { type: 'string' },
            role: { type: 'string' },
            duration: { type: 'string' },
            highlights: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['company', 'role', 'duration', 'highlights'],
        },
      },

      projects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            technologies: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['name', 'description', 'technologies'],
        },
      },

      education: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            degree: { type: 'string' },
            institution: { type: 'string' },
            year: { type: 'string' },
          },
          required: ['degree', 'institution', 'year'],
        },
      },

      summary: {
        type: 'string',
      },
    },

    required: ['skills', 'experience', 'projects', 'education', 'summary'],
  },
};

/**
 * Generate content using the local Llama.cpp server.
 * Uses the OpenAI-compatible /v1/chat/completions endpoint with
 * json_schema response_format for guaranteed structured output.
 *
 * @param {string} prompt - The user prompt to send
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If the request fails, times out, or response is unparseable
 */
const generateContentWithLlama = async (prompt) => {
  const start = Date.now();

  const response = await axios.post(
    `${LLAMA_SERVER_URL}/v1/chat/completions`,
    {
      messages: [
        {
          role: 'system',
          content:
            'You are a resume parsing engine that outputs only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],

      temperature: 0,
      top_p: 0.9,

      response_format: {
        type: 'json_schema',
        json_schema: RESUME_JSON_SCHEMA,
      },
    },
    {
      timeout: LLAMA_TIMEOUT_MS,
    }
  );

  const elapsed = Date.now() - start;

  const text = response.data.choices[0].message.content;

  const parsed = JSON.parse(text);

  console.log(`⏱️  Llama extraction completed in ${elapsed}ms`);

  return parsed;
};

module.exports = { generateContentWithLlama };
