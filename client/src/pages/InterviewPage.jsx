import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { interviewAPI } from '../services/api';
import ttsService from '../services/ttsService';

import LoadingSpinner from '../components/LoadingSpinner';
import VoiceRecorder from '../components/VoiceRecorder';
import AudioWaveform from '../components/AudioWaveform';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  X, CheckCircle2, Mic, ArrowRight, ArrowLeft, Clock,
  User, Send, Loader2, MessageCircle, Eraser,
  Volume2, VolumeX, StopCircle, ChevronDown, ChevronUp,
  Keyboard, RotateCcw, MicOff, Type
} from 'lucide-react';

/**
 * Interview phase definitions for the progress stepper.
 */
const PHASES = [
  { key: 'resume', label: 'Resume', icon: '📄', color: '#10b981' },
  { key: 'technical', label: 'Technical', icon: '💻', color: '#10b981' },
  { key: 'conceptual', label: 'Conceptual', icon: '✨', color: '#7c3aed' },
  { key: 'behavioral', label: 'Behavioral', icon: '🤝', color: '#9ca3af' },
];

const getPhaseIndex = (phase) => {
  const idx = PHASES.findIndex((p) => p.key === phase);
  return idx >= 0 ? idx : 0;
};

const formatTimer = (seconds) => {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

/* ── Memoized: Single history item ───────────────────────────────────── */

const HistoryItem = memo(({ item, index, isExpanded, onToggle }) => {
  return (
    <div className="iv-history-item">
      <button
        onClick={onToggle}
        className="iv-history-btn"
      >
        <div className="iv-history-header">
          <div className="iv-history-meta">
            <span className="iv-history-badge">Q{index + 1}</span>
            <span className="iv-history-type">{item.type}</span>
            {item.isFollowUp && <span className="iv-history-followup">Follow-up</span>}
          </div>
          <div className="iv-history-actions">
            <CheckCircle2 className="w-4 h-4" style={{ color: '#10b981' }} />
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" style={{ color: '#767683' }} />
            ) : (
              <ChevronDown className="w-4 h-4" style={{ color: '#767683' }} />
            )}
          </div>
        </div>
        <p className={`iv-history-question ${isExpanded ? '' : 'iv-clamp-1'}`}>
          {item.question}
        </p>
      </button>
      {isExpanded && (
        <div className="iv-history-answer-wrap">
          <div className="iv-history-answer-label">
            <User className="w-3 h-3" style={{ color: '#767683' }} />
            <span>Your Answer</span>
          </div>
          <p className="iv-history-answer-text">{item.answer}</p>
        </div>
      )}
    </div>
  );
});
HistoryItem.displayName = 'HistoryItem';

/* ── Main Interview Component ────────────────────────────────────────── */

const InterviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Core state
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dynamic question flow state
  const [conversationHistory, setConversationHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [isInterviewComplete, setIsInterviewComplete] = useState(false);
  const [questionState, setQuestionState] = useState(null);

  // Timer & completion
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // TTS state
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // History expansion
  const [expandedHistoryIdx, setExpandedHistoryIdx] = useState(null);
  const [showPreviousResponses, setShowPreviousResponses] = useState(false);

  const timerRef = useRef(null);
  const historyEndRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const lastSpokenQuestionRef = useRef(null);

  // Total questions for progress (use from backend or fallback)
  const totalQuestions = questionState?.totalQuestions || 10;

  // Fetch interview on mount
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await interviewAPI.getById(id);
        const data = response.data.data;
        setInterview(data);

        const questions = data.questions || [];
        const answers = data.answers || [];
        const state = data.questionState;

        if (questions.length > 0) {
          const history = [];
          for (let i = 0; i < questions.length; i++) {
            const answer = answers.find((a) => a.questionIndex === i);
            if (answer) {
              history.push({
                question: questions[i].text,
                answer: answer.text,
                type: questions[i].type,
                isFollowUp: questions[i].isFollowUp || false,
                difficulty: questions[i].difficulty,
              });
            }
          }
          setConversationHistory(history);

          const lastQuestion = questions[questions.length - 1];
          const lastAnswered = answers.find((a) => a.questionIndex === questions.length - 1);

          if (lastAnswered) {
            if (state?.interviewPhase === 'complete') {
              setIsInterviewComplete(true);
              setCurrentQuestion(null);
            } else {
              setCurrentQuestion(null);
              setIsInterviewComplete(true);
            }
          } else {
            setCurrentQuestion({
              index: questions.length - 1,
              text: lastQuestion.text,
              type: lastQuestion.type,
              difficulty: lastQuestion.difficulty,
              isFollowUp: lastQuestion.isFollowUp || false,
            });
            setCurrentQuestionIndex(questions.length - 1);
          }

          setQuestionState(state);
        }
      } catch (err) {
        const message = err.response?.data?.error || 'Failed to load interview.';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };
    fetchInterview();
  }, [id]);

  // Timer
  useEffect(() => {
    if (interview && !isCompleting && !isInterviewComplete) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [interview, isCompleting, isInterviewComplete]);

  // Auto-scroll conversation history
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversationHistory, currentQuestion]);

  // TTS callbacks
  useEffect(() => {
    ttsService.onStart = () => setIsSpeaking(true);
    ttsService.onEnd = () => setIsSpeaking(false);
    ttsService.onError = () => setIsSpeaking(false);
    return () => { ttsService.destroy(); };
  }, []);

  // Speak the current question when it changes
  useEffect(() => {
    if (currentQuestion?.text && currentQuestion.text !== lastSpokenQuestionRef.current) {
      lastSpokenQuestionRef.current = currentQuestion.text;
      ttsService.speak(currentQuestion.text);
    }
  }, [currentQuestion]);

  // Sync TTS enabled state
  useEffect(() => {
    ttsService.setEnabled(isTTSEnabled);
  }, [isTTSEnabled]);

  const toggleTTS = useCallback(() => {
    setIsTTSEnabled((prev) => !prev);
  }, []);

  const handleSpeechActivity = useCallback(() => {
    // Future: visual indicators
  }, []);

  const handleStopSpeaking = useCallback(() => {
    ttsService.stop();
  }, []);

  const handleMuteAllTTS = useCallback(() => {
    setIsTTSEnabled(false);
  }, []);

  const handleRepeatQuestion = useCallback(() => {
    if (currentQuestion?.text) {
      lastSpokenQuestionRef.current = null; // allow re-speak
      ttsService.speak(currentQuestion.text);
    }
  }, [currentQuestion]);

  const handleTranscript = useCallback((text) => {
    setCurrentAnswer(text);
  }, []);

  const handleClearAnswer = useCallback(() => {
    setCurrentAnswer('');
    voiceRecorderRef.current?.clearTranscript();
  }, []);

  const toggleHistoryItem = useCallback((idx) => {
    setExpandedHistoryIdx((prev) => (prev === idx ? null : idx));
  }, []);

  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) {
      toast.error('Please record or type your answer first.');
      return;
    }

    ttsService.stop();
    setIsSubmittingAnswer(true);

    try {
      const response = await interviewAPI.submitAnswer(id, {
        questionIndex: currentQuestionIndex,
        text: currentAnswer.trim(),
      });

      const data = response.data.data;

      setConversationHistory((prev) => [
        ...prev,
        {
          question: currentQuestion.text,
          answer: currentAnswer.trim(),
          type: currentQuestion.type,
          isFollowUp: currentQuestion.isFollowUp,
          difficulty: currentQuestion.difficulty,
        },
      ]);

      setCurrentAnswer('');
      voiceRecorderRef.current?.clearTranscript();

      if (data.questionState) {
        setQuestionState(data.questionState);
      }

      if (data.isComplete) {
        setIsInterviewComplete(true);
        setCurrentQuestion(null);
        if (timerRef.current) clearInterval(timerRef.current);
        toast.success('All questions completed! You can now end the interview.');
      } else if (data.nextQuestion) {
        setCurrentQuestion({
          index: data.nextQuestion.index,
          text: data.nextQuestion.text,
          type: data.nextQuestion.type,
          difficulty: data.nextQuestion.difficulty,
          isFollowUp: data.nextQuestion.isFollowUp || false,
        });
        setCurrentQuestionIndex(data.nextQuestion.index);
      }
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to submit answer.';
      toast.error(message);
    } finally {
      setIsSubmittingAnswer(false);
    }
  };

  const handleEndInterview = async () => {
    setShowConfirmModal(false);
    setIsCompleting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await interviewAPI.complete(id, { duration: timerSeconds });
      toast.success('Interview completed! Viewing results...');
      navigate(`/results/${id}`);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to submit interview.';
      toast.error(message);
      setIsCompleting(false);
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  const answeredCount = conversationHistory.length;
  const currentPhaseIdx = getPhaseIndex(questionState?.interviewPhase || 'resume');
  const progressPercent = totalQuestions > 0 ? ((answeredCount) / totalQuestions) * 100 : 0;

  // --- Loading ---
  if (loading) {
    return (
      <div className="page-enter min-h-screen bg-[#f7f9fb]">
        <main className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="xl" text="Loading interview..." />
        </main>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div className="page-enter min-h-screen bg-[#f7f9fb]">
        <main className="min-h-screen flex items-center justify-center">
          <div className="card p-10 max-w-md text-center">
            <AlertTriangle className="w-12 h-12 text-[#ba1a1a] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#191c1e] mb-2">Error Loading Interview</h2>
            <p className="text-sm text-[#767683] mb-6">{error}</p>
            <button onClick={() => navigate('/dashboard')} className="btn-primary rounded-full">
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  // --- Completing / AI Evaluating ---
  if (isCompleting) {
    return (
      <div className="page-enter min-h-screen bg-[#f7f9fb]">
        <main className="min-h-screen flex items-center justify-center">
          <div className="card p-12 max-w-md w-full mx-4 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <img src="/assets/logo.png" alt="VoiceAI" className="w-20 h-20 object-contain animate-breathe" />
            </div>
            <LoadingSpinner size="lg" className="mb-5" />
            <h2 className="text-xl font-bold text-[#191c1e] mb-2">AI is Evaluating Your Interview</h2>
            <p className="text-sm text-[#767683] mb-1">Analyzing {answeredCount} answers...</p>
            <p className="text-xs text-[#c6c5d4]">This may take up to 2 minutes</p>
          </div>
        </main>
      </div>
    );
  }

  // --- Main Interview UI ---
  return (
    <div className="page-enter iv-page">
      {/* ===== Top Navigation Bar ===== */}
      <header className="iv-topbar">
        <div className="iv-topbar-inner">
          {/* Left: Back + Brand */}
          <div className="iv-topbar-left">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="iv-back-btn"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="iv-brand">VoiceAI</span>
          </div>

          {/* Center: Phase Stepper */}
          <nav className="iv-phase-stepper">
            {PHASES.map((phase, i) => {
              const isActive = i === currentPhaseIdx;
              const isDone = i < currentPhaseIdx || questionState?.interviewPhase === 'complete';
              return (
                <div key={phase.key} className="iv-phase-item">
                  <div
                    className={`iv-phase-pill ${
                      isActive ? 'iv-phase-active' : isDone ? 'iv-phase-done' : 'iv-phase-pending'
                    }`}
                  >
                    <span className={`iv-phase-dot ${
                      isActive ? 'iv-dot-active' : isDone ? 'iv-dot-done' : 'iv-dot-pending'
                    }`} />
                    {isDone && !isActive ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <span className="iv-phase-icon">{phase.icon}</span>
                    )}
                    <span className="iv-phase-label">{phase.label}</span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <div className={`iv-phase-connector ${isDone ? 'iv-connector-done' : ''}`} />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right: End Interview */}
          <div className="iv-topbar-right">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="iv-end-btn"
            >
              End Interview
            </button>
          </div>
        </div>
      </header>

      {/* ===== Main Content ===== */}
      <main className="iv-main">
        <div className="iv-content-wrapper">

          {/* ===== Main Interview Card ===== */}
          {currentQuestion && !isInterviewComplete ? (
            <div className="iv-card question-enter">
              {/* Progress Bar */}
              <div className="iv-progress-section">
                <span className="iv-progress-label">
                  Question {answeredCount + 1} of {totalQuestions}
                </span>
                <div className="iv-progress-track">
                  <div
                    className="iv-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* AI Avatar */}
              <div className="iv-avatar-section">
                <div className="iv-avatar-container">
                  <div className={`iv-avatar ${isSpeaking ? 'iv-avatar-speaking' : 'iv-avatar-idle'}`}>
                    <img src="/assets/logo.png" alt="AI Interviewer" className="iv-avatar-img" />
                  </div>
                  {/* Green active dot */}
                  <div className="iv-avatar-status-dot" />
                  {/* Speaking rings */}
                  {isSpeaking && (
                    <>
                      <div className="speaking-ring" />
                      <div className="speaking-ring speaking-ring-delayed" />
                    </>
                  )}
                </div>

                {/* Waveform indicator */}
                <div className="iv-waveform-indicator">
                  <AudioWaveform isActive={isSpeaking} barCount={5} className="h-5" />
                </div>
              </div>

              {/* Question Text */}
              <div className="iv-question-text">
                <p>{currentQuestion.text}</p>
              </div>

              {/* Answer Input Area */}
              <div className="iv-answer-area">
                {currentAnswer.trim() ? (
                  <p className="iv-answer-text">{currentAnswer}</p>
                ) : (
                  <p className="iv-answer-placeholder">Listening...</p>
                )}
              </div>

              {/* Hidden VoiceRecorder — functional but visually replaced */}
              <div className="iv-voice-recorder-hidden">
                <VoiceRecorder
                  ref={voiceRecorderRef}
                  onTranscript={handleTranscript}
                  disabled={isSubmittingAnswer}
                  onSpeechActivity={handleSpeechActivity}
                  isTTSSpeaking={isSpeaking}
                />
              </div>

              {/* Action Pills Row */}
              <div className="iv-action-pills">
                <button className="iv-pill" onClick={() => {
                  // Toggle text input in VoiceRecorder
                }} title="Switch to text input">
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Type</span>
                </button>
                <button
                  className="iv-pill"
                  onClick={handleClearAnswer}
                  disabled={!currentAnswer.trim() || isSubmittingAnswer}
                  title="Erase answer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Erase</span>
                </button>
                {isSpeaking && (
                  <button className="iv-pill" onClick={handleStopSpeaking} title="Stop AI speaking">
                    <StopCircle className="w-3.5 h-3.5" />
                    <span>Stop</span>
                  </button>
                )}
                <button
                  className="iv-pill"
                  onClick={handleMuteAllTTS}
                  title="Mute all AI voice"
                >
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Mute All</span>
                </button>
              </div>

              {/* Bottom Controls */}
              <div className="iv-bottom-controls">
                {/* Left: Repeat Question */}
                <button className="iv-repeat-btn" onClick={handleRepeatQuestion} title="Repeat question">
                  <RotateCcw className="w-4 h-4" />
                  <span>Repeat Question</span>
                </button>

                {/* Center: Mic Button */}
                <div className="iv-mic-center">
                  <button className={`iv-mic-btn ${isSpeaking ? 'iv-mic-muted' : ''}`} title="Microphone">
                    {isSpeaking ? (
                      <MicOff className="w-6 h-6" />
                    ) : (
                      <Mic className="w-6 h-6" />
                    )}
                  </button>
                </div>

                {/* Right: Submit Answer */}
                {isSubmittingAnswer ? (
                  <div className="iv-submit-btn iv-submit-loading">
                    <div className="flex gap-1.5">
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                      <div className="typing-dot" />
                    </div>
                    <span>Thinking...</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={!currentAnswer.trim()}
                    className={`iv-submit-btn ${currentAnswer.trim() ? 'iv-submit-active' : 'iv-submit-disabled'}`}
                  >
                    <span>Submit Answer</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {/* ===== Interview Complete Card ===== */}
          {isInterviewComplete && !isCompleting ? (
            <div className="iv-card iv-complete-card">
              <div className="iv-complete-icon">
                <CheckCircle2 className="w-10 h-10" style={{ color: '#10b981' }} />
              </div>
              <h2 className="iv-complete-title">All Questions Completed!</h2>
              <p className="iv-complete-subtitle">
                You&apos;ve answered {answeredCount} questions across all interview phases.
              </p>
              <p className="iv-complete-hint">
                Click &quot;End Interview&quot; below to get your AI evaluation report.
              </p>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="iv-submit-btn iv-submit-active mt-6"
              >
                End Interview & Get Results
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          {/* ===== Previous Responses Accordion ===== */}
          {conversationHistory.length > 0 && (
            <div className="iv-prev-responses">
              <button
                className="iv-prev-toggle"
                onClick={() => setShowPreviousResponses(!showPreviousResponses)}
              >
                <div className="iv-prev-toggle-left">
                  <Clock className="w-5 h-5" style={{ color: '#767683' }} />
                  <span>Previous Responses</span>
                </div>
                {showPreviousResponses ? (
                  <ChevronUp className="w-5 h-5" style={{ color: '#767683' }} />
                ) : (
                  <ChevronDown className="w-5 h-5" style={{ color: '#767683' }} />
                )}
              </button>
              {showPreviousResponses && (
                <div className="iv-prev-list">
                  {conversationHistory.map((item, i) => (
                    <HistoryItem
                      key={i}
                      item={item}
                      index={i}
                      isExpanded={expandedHistoryIdx === i}
                      onToggle={() => toggleHistoryItem(i)}
                    />
                  ))}
                  <div ref={historyEndRef} />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ===== Confirmation Modal ===== */}
      {showConfirmModal ? (
        <div className="iv-modal-overlay">
          <div className="iv-modal-backdrop" onClick={() => setShowConfirmModal(false)} />
          <div className="iv-modal animate-scale-in">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="iv-modal-close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="iv-modal-icon-wrap iv-modal-icon-danger">
              <AlertTriangle className="w-8 h-8" style={{ color: '#ba1a1a' }} />
            </div>

            <h3 className="iv-modal-title">End Interview?</h3>
            <p className="iv-modal-desc">
              {isInterviewComplete
                ? 'Your interview is complete. Submit for AI evaluation?'
                : 'Are you sure you want to end the interview early?'}
            </p>
            {!isInterviewComplete ? (
              <p className="iv-modal-warning">
                Some question phases may not be completed yet.
              </p>
            ) : null}

            <div className="iv-modal-stats">
              <div className="iv-modal-stat">
                <p className="iv-modal-stat-value">{answeredCount}</p>
                <p className="iv-modal-stat-label">Answered</p>
              </div>
              <div className="iv-modal-stat-divider" />
              <div className="iv-modal-stat">
                <p className="iv-modal-stat-value iv-capitalize">{questionState?.interviewPhase || 'resume'}</p>
                <p className="iv-modal-stat-label">Phase</p>
              </div>
              <div className="iv-modal-stat-divider" />
              <div className="iv-modal-stat">
                <p className="iv-modal-stat-value iv-mono">{formatTimer(timerSeconds)}</p>
                <p className="iv-modal-stat-label">Duration</p>
              </div>
            </div>

            <div className="iv-modal-actions">
              <button onClick={() => setShowConfirmModal(false)} className="iv-modal-btn-secondary">
                Continue
              </button>
              <button
                onClick={handleEndInterview}
                className="iv-modal-btn-danger"
              >
                End Interview
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default InterviewPage;
