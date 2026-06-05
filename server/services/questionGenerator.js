const { generateContent } = require('./geminiClient');
const {
  getInitialQuestionPrompt,
  getNextQuestionPrompt,
  buildConversationHistory,
} = require('../prompts/questionPrompt');

/**
 * Question Generator Service.
 * Uses Gemini AI to generate interview questions one at a time,
 * dynamically based on conversation history and interview state.
 */

/**
 * Interview question budget constants.
 */
const QUESTION_LIMITS = {
  RESUME_MIN: 3,
  RESUME_MAX: 4,
  TECHNICAL: 2,
  CONCEPTUAL: 2,
  BEHAVIORAL: 2,
  MAX_FOLLOW_UPS_PER_TOPIC: 2,
};

/**
 * Generate the very first interview question (resume-based).
 * @param {Object} resumeAnalysis - Structured resume data
 * @param {string} role - Target job role
 * @param {string} jobDescription - Optional job description text
 * @returns {Promise<Object>} Single question object { text, type, difficulty, isFollowUp, topicCovered }
 */
const generateInitialQuestion = async (resumeAnalysis, role, jobDescription) => {
  try {
    const prompt = getInitialQuestionPrompt(resumeAnalysis, role, jobDescription);
    const question = await generateContent(prompt);

    // Validate response shape
    if (!question || !question.text) {
      throw new Error('Invalid question format returned from Gemini');
    }

    return {
      text: question.text,
      type: question.type || 'resume-based',
      difficulty: question.difficulty || 'medium',
      isFollowUp: false,
      parentQuestionIndex: null,
    };
  } catch (error) {
    console.error('❌ Initial question generation failed:', error.message);
    throw new Error(`Initial question generation failed: ${error.message}`);
  }
};

/**
 * Determine if we should transition to the next interview phase.
 * Returns the updated questionState with the correct interviewPhase.
 *
 * @param {Object} questionState - Current question state from the interview
 * @param {boolean} isFollowUp - Whether the last generated question was a follow-up
 * @returns {Object} Updated questionState
 */
const determineNextPhase = (questionState) => {
  const state = { ...questionState };

  // Check resume phase completion
  if (state.interviewPhase === 'resume') {
    // Move on if we've asked at least RESUME_MIN main questions
    // and the follow-up count is 0 (meaning we just finished a topic)
    // OR if we've hit RESUME_MAX
    if (state.resumeQuestionsAsked >= QUESTION_LIMITS.RESUME_MAX) {
      state.interviewPhase = 'technical';
      state.currentFollowUpCount = 0;
    }
    // Also move on if we have >= RESUME_MIN and no pending follow-ups
    // (This is handled by the controller checking if AI chose not to follow up)
  }

  // Check technical phase completion
  if (state.interviewPhase === 'technical' && state.technicalAsked >= QUESTION_LIMITS.TECHNICAL) {
    state.interviewPhase = 'conceptual';
  }

  // Check conceptual phase completion
  if (state.interviewPhase === 'conceptual' && state.conceptualAsked >= QUESTION_LIMITS.CONCEPTUAL) {
    state.interviewPhase = 'behavioral';
  }

  // Check behavioral phase completion
  if (state.interviewPhase === 'behavioral' && state.behavioralAsked >= QUESTION_LIMITS.BEHAVIORAL) {
    state.interviewPhase = 'complete';
  }

  return state;
};

/**
 * Generate the next interview question dynamically based on conversation history.
 *
 * @param {Object} interview - Full Mongoose interview document
 * @returns {Promise<Object>} { question, updatedState, isComplete }
 *   - question: { text, type, difficulty, isFollowUp, parentQuestionIndex }
 *   - updatedState: updated questionState to save back to DB
 *   - isComplete: true if the interview has exhausted all question phases
 */
const generateNextQuestion = async (interview) => {
  try {
    let state = { ...interview.questionState.toObject() };

    // First check if interview is already complete
    state = determineNextPhase(state);
    if (state.interviewPhase === 'complete') {
      return { question: null, updatedState: state, isComplete: true };
    }

    // Build conversation history for context
    const conversationHistory = buildConversationHistory(
      interview.questions,
      interview.answers
    );

    // Generate next question prompt
    const prompt = getNextQuestionPrompt(
      interview.resumeAnalysis,
      interview.role,
      conversationHistory,
      state,
      interview.jobDescText || ''
    );

    const questionData = await generateContent(prompt);

    // Validate response
    if (!questionData || !questionData.text) {
      throw new Error('Invalid question format returned from Gemini');
    }

    // Build the question object
    const question = {
      text: questionData.text,
      type: questionData.type || state.interviewPhase,
      difficulty: questionData.difficulty || 'medium',
      isFollowUp: false,
      parentQuestionIndex: null,
    };

    // Update state counters based on what was generated
    if (state.interviewPhase === 'resume') {
      if (questionData.isFollowUp && state.currentFollowUpCount < QUESTION_LIMITS.MAX_FOLLOW_UPS_PER_TOPIC) {
        // It's a follow-up on the same topic
        question.isFollowUp = true;
        // Find the parent main question index (the last non-follow-up resume question)
        for (let i = interview.questions.length - 1; i >= 0; i--) {
          if (!interview.questions[i].isFollowUp && interview.questions[i].type === 'resume-based') {
            question.parentQuestionIndex = i;
            break;
          }
        }
        state.currentFollowUpCount += 1;
      } else {
        // New main resume question
        question.isFollowUp = false;
        state.resumeQuestionsAsked += 1;
        state.currentFollowUpCount = 0;
        if (questionData.topicCovered) {
          state.currentResumeTopics.push(questionData.topicCovered);
        }
      }
    } else if (state.interviewPhase === 'technical') {
      question.type = 'technical';
      state.technicalAsked += 1;
    } else if (state.interviewPhase === 'conceptual') {
      question.type = 'conceptual';
      state.conceptualAsked += 1;
    } else if (state.interviewPhase === 'behavioral') {
      question.type = 'behavioral';
      state.behavioralAsked += 1;
    }

    // Check if we should transition to the next phase after this question
    state = determineNextPhase(state);

    return {
      question,
      updatedState: state,
      isComplete: state.interviewPhase === 'complete',
    };
  } catch (error) {
    console.error('❌ Next question generation failed:', error.message);
    throw new Error(`Next question generation failed: ${error.message}`);
  }
};

module.exports = {
  generateInitialQuestion,
  generateNextQuestion,
  QUESTION_LIMITS,
};
