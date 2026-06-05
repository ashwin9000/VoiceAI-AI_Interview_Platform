/**
 * Question Generation Prompts for Gemini AI.
 *
 * Two prompt generators:
 * 1. getInitialQuestionPrompt — generates the very first resume-based question
 * 2. getNextQuestionPrompt — generates the next single question based on
 *    conversation history and interview state
 */

/**
 * Build a readable conversation history string from questions and answers.
 * @param {Array} questions - Array of question objects
 * @param {Array} answers - Array of answer objects
 * @returns {string} Formatted Q&A history
 */
const buildConversationHistory = (questions, answers) => {
  if (!questions || questions.length === 0) return 'No conversation history yet.';

  return questions
    .map((q, index) => {
      const answer = answers.find((a) => a.questionIndex === index);
      const followUpLabel = q.isFollowUp ? ' [FOLLOW-UP]' : '';
      return `Q${index + 1} [${q.type}]${followUpLabel}: ${q.text}\nAnswer: ${answer ? answer.text : '(Not yet answered)'}`;
    })
    .join('\n\n');
};

/**
 * Generate a prompt for the very first interview question (resume-based).
 * @param {Object} resumeAnalysis - Structured resume data
 * @param {string} role - Target job role
 * @param {string} jobDescription - Optional job description text
 * @returns {string} The formatted prompt string
 */
const getInitialQuestionPrompt = (resumeAnalysis, role, jobDescription) => {
  const jdSection = jobDescription
    ? `\nJOB DESCRIPTION:\n${jobDescription}`
    : '';

  return `You are an expert technical interviewer conducting a live interview. Generate the FIRST interview question for a candidate applying for the role of "${role}".

CANDIDATE RESUME ANALYSIS:
${JSON.stringify(resumeAnalysis, null, 2)}
${jdSection}

This first question should be a RESUME-BASED question. Pick the most interesting or significant project/experience from the candidate's resume and ask about it. The question should be conversational and engaging.

The difficulty should be "easy" or "medium" — start the interview gently.

Return ONLY a valid JSON object with the following structure (no markdown, no code fences, no extra text):
{
  "text": "The interview question text",
  "type": "resume-based",
  "difficulty": "medium",
  "isFollowUp": false,
  "topicCovered": "Brief label of the project/topic being asked about"
}

IMPORTANT:
- Return ONLY the JSON object, nothing else.
- The question should reference a specific project or experience from the resume.
- Make it conversational — like a real interviewer would ask.
- Each question should be clear and answerable in 2-3 minutes.`;
};

/**
 * Generate a prompt for the next interview question based on conversation history.
 * @param {Object} resumeAnalysis - Structured resume data
 * @param {string} role - Target job role
 * @param {string} conversationHistory - Formatted Q&A history string
 * @param {Object} questionState - Current interview state counters
 * @param {string} jobDescription - Optional job description text
 * @returns {string} The formatted prompt string
 */
const getNextQuestionPrompt = (resumeAnalysis, role, conversationHistory, questionState, jobDescription) => {
  const jdSection = jobDescription
    ? `\nJOB DESCRIPTION:\n${jobDescription}`
    : '';

  // Determine what the AI should generate next
  const { interviewPhase, currentFollowUpCount, currentResumeTopics, resumeQuestionsAsked } = questionState;

  let phaseInstruction = '';
  let allowFollowUp = false;

  switch (interviewPhase) {
    case 'resume':
      if (currentFollowUpCount < 2) {
        allowFollowUp = true;
        phaseInstruction = `You are in the RESUME-BASED phase.

You just received the candidate's answer to the previous question. You have two options:

OPTION A — ASK A FOLLOW-UP (recommended if the answer was interesting, vague, or warrants deeper exploration):
- Set "isFollowUp": true
- Dig deeper into the SAME project/topic from the previous question
- Follow-ups asked so far for this topic: ${currentFollowUpCount}/2
- Ask about architecture decisions, challenges faced, trade-offs made, or specific implementation details

OPTION B — MOVE TO A NEW RESUME TOPIC:
- Set "isFollowUp": false
- Pick a DIFFERENT project/experience from the resume
- Do NOT revisit these already-covered topics: ${currentResumeTopics.join(', ') || 'none yet'}
- Resume main questions asked so far: ${resumeQuestionsAsked}/4

Choose the option that would give the best signal about the candidate's abilities. If the previous answer was thorough and complete, prefer moving to a new topic. If it was shallow or intriguing, prefer a follow-up.`;
      } else {
        phaseInstruction = `You are in the RESUME-BASED phase.

You've already asked ${currentFollowUpCount} follow-ups on the current topic. You MUST now move to a NEW resume project/experience.
- Set "isFollowUp": false
- Do NOT revisit these already-covered topics: ${currentResumeTopics.join(', ') || 'none yet'}
- Resume main questions asked so far: ${resumeQuestionsAsked}/4`;
      }
      break;

    case 'technical':
      phaseInstruction = `You are now in the TECHNICAL phase.

Generate a TECHNICAL question that tests specific technical skills relevant to the "${role}" role and the candidate's background.
- Set "type": "technical"
- Set "isFollowUp": false
- Focus on practical technical knowledge, coding concepts, system design, or tools mentioned in the resume.
- Make it challenging but fair.
- Technical questions asked so far: ${questionState.technicalAsked}/2`;
      break;

    case 'conceptual':
      phaseInstruction = `You are now in the CONCEPTUAL phase.

Generate a CONCEPTUAL question that tests understanding of core principles and concepts relevant to the "${role}" role.
- Set "type": "conceptual"
- Set "isFollowUp": false
- Focus on understanding of fundamentals, design patterns, best practices, or architectural principles.
- Conceptual questions asked so far: ${questionState.conceptualAsked}/2`;
      break;

    case 'behavioral':
      phaseInstruction = `You are now in the BEHAVIORAL phase.

Generate a BEHAVIORAL question that assesses soft skills, teamwork, conflict resolution, or problem-solving approach.
- Set "type": "behavioral"
- Set "isFollowUp": false
- Use STAR format questions (Situation, Task, Action, Result).
- Behavioral questions asked so far: ${questionState.behavioralAsked}/2`;
      break;

    default:
      phaseInstruction = 'The interview is complete. No more questions needed.';
      break;
  }

  return `You are an expert technical interviewer conducting a live interview for the role of "${role}". Generate the NEXT single interview question based on the conversation so far.

CANDIDATE RESUME ANALYSIS:
${JSON.stringify(resumeAnalysis, null, 2)}
${jdSection}

CONVERSATION HISTORY:
${conversationHistory}

CURRENT INTERVIEW STATE:
- Phase: ${interviewPhase}
- Resume main questions asked: ${resumeQuestionsAsked}/4
- Follow-ups on current topic: ${currentFollowUpCount}/2
- Technical asked: ${questionState.technicalAsked}/2
- Conceptual asked: ${questionState.conceptualAsked}/2
- Behavioral asked: ${questionState.behavioralAsked}/2
- Topics already covered: ${currentResumeTopics.join(', ') || 'none'}

INSTRUCTIONS:
${phaseInstruction}

Vary the difficulty across questions. Mix easy, medium, and hard.

Return ONLY a valid JSON object with the following structure (no markdown, no code fences, no extra text):
{
  "text": "The interview question text",
  "type": "${interviewPhase === 'resume' ? 'resume-based' : interviewPhase}",
  "difficulty": "medium",
  "isFollowUp": ${allowFollowUp ? 'true or false based on your decision' : 'false'},
  "topicCovered": "Brief label of the project/topic being asked about (for resume-based questions only, otherwise null)"
}

IMPORTANT:
- Return ONLY the JSON object, nothing else.
- Make the question contextually relevant to the conversation so far.
- Do NOT repeat or closely paraphrase any question already asked.
- Be conversational — like a real interviewer.
- Each question should be clear and answerable in 2-3 minutes.`;
};

module.exports = { getInitialQuestionPrompt, getNextQuestionPrompt, buildConversationHistory };
