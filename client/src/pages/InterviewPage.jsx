import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { interviewAPI } from '../services/api';
import ttsService from '../services/ttsService';

import LoadingSpinner from '../components/LoadingSpinner';
import VoiceRecorder from '../components/VoiceRecorder';
import AudioWaveform from '../components/AudioWaveform';
import toast from 'react-hot-toast';
import {
  BrainCircuit, AlertTriangle,
  X, CheckCircle2, Mic, ArrowRight, Clock,
  User, Check, Send, Loader2, MessageCircle, Eraser,
  Volume2, VolumeX, StopCircle
} from 'lucide-react';

/**
 * Interview phase definitions for the progress indicator.
 */
const PHASES = [
  { key: 'resume', label: 'Resume', icon: '📄' },
  { key: 'technical', label: 'Technical', icon: '⚙️' },
  { key: 'conceptual', label: 'Conceptual', icon: '💡' },
  { key: 'behavioral', label: 'Behavioral', icon: '🤝' },
];

const InterviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Core state
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dynamic question flow state
  const [conversationHistory, setConversationHistory] = useState([]); // { question, answer, type, isFollowUp }
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

  const timerRef = useRef(null);
  const historyEndRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const lastSpokenQuestionRef = useRef(null);

  // Fetch interview on mount
  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await interviewAPI.getById(id);
        const data = response.data.data;
        setInterview(data);

        // Reconstruct state from existing interview data
        const questions = data.questions || [];
        const answers = data.answers || [];
        const state = data.questionState;

        if (questions.length > 0) {
          // Build conversation history from already answered questions
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

          // The last question without an answer is the current question
          const lastQuestion = questions[questions.length - 1];
          const lastAnswered = answers.find((a) => a.questionIndex === questions.length - 1);

          if (lastAnswered) {
            // All questions answered — check if complete
            if (state?.interviewPhase === 'complete') {
              setIsInterviewComplete(true);
              setCurrentQuestion(null);
            } else {
              // Shouldn't happen normally — all answered but not complete
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

  // ──────────────────────────────────────────────
  // TTS — Auto-speak new questions
  // ──────────────────────────────────────────────

  useEffect(() => {
    // Wire up TTS callbacks
    ttsService.onStart = () => setIsSpeaking(true);
    ttsService.onEnd = () => setIsSpeaking(false);
    ttsService.onError = () => setIsSpeaking(false);

    return () => {
      ttsService.destroy();
    };
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
    setIsTTSEnabled(prev => !prev);
  }, []);

  // VAD speech activity callback
  const handleSpeechActivity = useCallback((isSpeaking) => {
    // Future: could show visual indicators at the page level
  }, []);

  // Stop TTS for current question only
  const handleStopSpeaking = useCallback(() => {
    ttsService.stop();
  }, []);

  // Mute TTS for the rest of the interview session
  const handleMuteAllTTS = useCallback(() => {
    setIsTTSEnabled(false);
  }, []);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleTranscript = useCallback((text) => {
    setCurrentAnswer(text);
  }, []);

  /**
   * Clear the current answer transcript.
   */
  const handleClearAnswer = useCallback(() => {
    setCurrentAnswer('');
    voiceRecorderRef.current?.clearTranscript();
  }, []);

  /**
   * Submit the current answer, receive the next question from AI.
   */
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) {
      toast.error('Please record or type your answer first.');
      return;
    }

    // Stop TTS before submitting
    ttsService.stop();
    setIsSubmittingAnswer(true);

    try {
      const response = await interviewAPI.submitAnswer(id, {
        questionIndex: currentQuestionIndex,
        text: currentAnswer.trim(),
      });

      const data = response.data.data;

      // Add current Q&A to conversation history
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

      // Clear current answer and voice recorder
      setCurrentAnswer('');
      voiceRecorderRef.current?.clearTranscript();

      // Update question state
      if (data.questionState) {
        setQuestionState(data.questionState);
      }

      if (data.isComplete) {
        // Interview is complete — no more questions
        setIsInterviewComplete(true);
        setCurrentQuestion(null);
        if (timerRef.current) clearInterval(timerRef.current);
        toast.success('All questions completed! You can now end the interview.');
      } else if (data.nextQuestion) {
        // Set the new question (TTS will auto-speak via useEffect)
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

  /**
   * End the interview and trigger AI evaluation.
   */
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

  const getTypeColor = (t) => {
    switch (t?.toLowerCase()) {
      case 'technical': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' };
      case 'behavioral': return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' };
      case 'conceptual': return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' };
      case 'resume-based': return { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200', dot: 'bg-pink-500' };
      default: return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' };
    }
  };

  const getPhaseIndex = (phase) => {
    const idx = PHASES.findIndex((p) => p.key === phase);
    return idx >= 0 ? idx : 0;
  };

  const answeredCount = conversationHistory.length;

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
            <div className="w-20 h-20 rounded-2xl bg-[#000666] flex items-center justify-center mx-auto mb-6 animate-pulse">
              <BrainCircuit className="w-10 h-10 text-white" />
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
    <div className="page-enter min-h-screen bg-[#f7f9fb]">
      <main className="min-h-screen flex flex-col">
        {/* ===== Sticky Top Bar ===== */}
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#e5e7eb]">
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-medium text-[#191c1e]">Recording</span>
            </div>

            {/* Phase Progress Indicator */}
            <div className="hidden sm:flex items-center gap-1">
              {PHASES.map((phase, i) => {
                const currentPhaseIdx = getPhaseIndex(questionState?.interviewPhase || 'resume');
                const isActive = i === currentPhaseIdx;
                const isDone = i < currentPhaseIdx || questionState?.interviewPhase === 'complete';
                return (
                  <div key={phase.key} className="flex items-center">
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#000666] text-white shadow-sm'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-gray-50 text-[#767683] border border-gray-200'
                      }`}
                    >
                      {isDone && !isActive ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <span>{phase.icon}</span>
                      )}
                      <span className="hidden md:inline">{phase.label}</span>
                    </div>
                    {i < PHASES.length - 1 && (
                      <div className={`w-4 h-0.5 mx-0.5 ${isDone ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              {/* TTS Toggle */}
              <button
                onClick={toggleTTS}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                  isTTSEnabled
                    ? 'text-[#000666] bg-[#eef2ff] border-[#e0e0ff] hover:bg-[#e0e0ff]'
                    : 'text-[#767683] bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
                title={isTTSEnabled ? 'Disable AI voice' : 'Enable AI voice'}
              >
                {isTTSEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isTTSEnabled ? 'Voice On' : 'Voice Off'}</span>
              </button>

              <div className="flex items-center gap-2 bg-[#f7f9fb] border border-[#e5e7eb] rounded-full px-4 py-1.5">
                <Clock className="w-4 h-4 text-[#000666]" />
                <span className="text-sm font-mono font-semibold text-[#191c1e] tracking-wider">
                  {formatTimer(timerSeconds)}
                </span>
              </div>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full border border-red-200 transition-all"
              >
                End
              </button>
            </div>
          </div>
        </div>

        {/* ===== Scrollable Content ===== */}
        <div className="flex-1 overflow-y-auto pb-24">
          {/* AI Avatar Area */}
          <div className="mx-6 mt-6 rounded-2xl bg-gradient-to-br from-cyan-100 via-purple-100 to-blue-100 min-h-[200px] relative flex items-center justify-center overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-12 -left-12 w-48 h-48 bg-cyan-200/40 rounded-full blur-2xl" />
              <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-purple-200/40 rounded-full blur-2xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-200/30 rounded-full blur-3xl" />
            </div>

            {/* AI Bot Icon + Speaking Indicator */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div className={`w-20 h-20 rounded-3xl bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center border border-white/60 transition-all duration-300 ${
                isSpeaking ? 'ring-4 ring-[#000666]/20 scale-105' : ''
              }`}>
                <BrainCircuit className="w-10 h-10 text-[#000666]" />
              </div>

              {/* Speaking indicator with waveform */}
              {isSpeaking ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 bg-[#000666]/90 backdrop-blur-sm rounded-full px-4 py-1.5 border border-[#000666]/30">
                    <AudioWaveform isActive={true} barCount={4} className="h-4" />
                    <span className="text-xs font-medium text-white">Speaking...</span>
                  </div>

                  {/* Stop Speaking Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStopSpeaking}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-sm text-[#ba1a1a] border border-red-200 hover:bg-red-50 hover:border-red-300 transition-all shadow-sm"
                    >
                      <StopCircle className="w-3.5 h-3.5" />
                      Stop Speaking
                    </button>
                    <button
                      onClick={handleMuteAllTTS}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-sm text-[#767683] border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                      title="Disable voice for all remaining questions"
                    >
                      <VolumeX className="w-3.5 h-3.5" />
                      Mute All
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-full px-4 py-1.5 border border-white/50">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-[#191c1e]">AI Interviewer Active</span>
                </div>
              )}
            </div>

            {/* Webcam feed simulation – top-right */}
            <div className="absolute top-4 right-4 w-16 h-16 rounded-xl bg-[#191c1e]/80 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-md">
              <User className="w-7 h-7 text-white/70" />
            </div>
          </div>

          {/* ===== Conversation History ===== */}
          {conversationHistory.length > 0 && (
            <div className="mx-6 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4 text-[#767683]" />
                <span className="text-xs font-semibold text-[#767683] uppercase tracking-wider">
                  Conversation History ({conversationHistory.length} answered)
                </span>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {conversationHistory.map((item, i) => {
                  const colors = getTypeColor(item.type);
                  return (
                    <div key={i} className="rounded-xl border border-[#e5e7eb] bg-white overflow-hidden">
                      {/* Question bubble */}
                      <div className={`px-4 py-3 ${colors.bg} border-b ${colors.border}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-md bg-[#000666] flex items-center justify-center">
                            <BrainCircuit className="w-3 h-3 text-white" />
                          </div>
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text}`}>
                            {item.type}{item.isFollowUp ? ' · Follow-up' : ''} · Q{i + 1}
                          </span>
                        </div>
                        <p className="text-sm text-[#191c1e] leading-relaxed">{item.question}</p>
                      </div>
                      {/* Answer bubble */}
                      <div className="px-4 py-3 bg-white">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="w-5 h-5 rounded-md bg-[#f0f0f5] flex items-center justify-center">
                            <User className="w-3 h-3 text-[#767683]" />
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#767683]">
                            Your Answer
                          </span>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        </div>
                        <p className="text-sm text-[#454652] leading-relaxed line-clamp-3">{item.answer}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={historyEndRef} />
              </div>
            </div>
          )}

          {/* ===== Current Question Card ===== */}
          {currentQuestion && !isInterviewComplete && (
            <div className="card p-6 mx-6 mt-4 relative z-10 border-2 border-[#000666]/10">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">
                  Question {answeredCount + 1}
                  {currentQuestion.isFollowUp && (
                    <span className="ml-2 text-amber-600">· Follow-up</span>
                  )}
                </span>
                {currentQuestion.type && (
                  <span className={`text-xs font-medium px-3 py-1 rounded-full border ${getTypeColor(currentQuestion.type).bg} ${getTypeColor(currentQuestion.type).text} ${getTypeColor(currentQuestion.type).border}`}>
                    {currentQuestion.type}
                  </span>
                )}
              </div>

              {/* Question text */}
              <p className="text-lg sm:text-xl font-bold text-[#191c1e] leading-relaxed mb-4">
                &ldquo;{currentQuestion.text}&rdquo;
              </p>

              {/* Inline TTS controls — visible while AI is speaking the question */}
              {isSpeaking && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-[#000666]/5 border border-[#000666]/10">
                  <div className="flex items-center gap-1.5 mr-auto">
                    <AudioWaveform isActive={true} barCount={3} className="h-3" />
                    <span className="text-xs font-medium text-[#000666]">Reading aloud...</span>
                  </div>
                  <button
                    onClick={handleStopSpeaking}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#ba1a1a] bg-white border border-red-200 hover:bg-red-50 transition-all"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    Stop Reading
                  </button>
                  <button
                    onClick={handleMuteAllTTS}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#767683] bg-white border border-gray-200 hover:bg-gray-50 transition-all"
                    title="Disable voice for all remaining questions"
                  >
                    <VolumeX className="w-3.5 h-3.5" />
                    Mute All
                  </button>
                </div>
              )}

              {/* Answer input area */}
              <div className="bg-[#f7f9fb] rounded-xl p-5 border border-[#e5e7eb]">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-[#eef2ff] flex items-center justify-center flex-shrink-0">
                    <Mic className="w-4 h-4 text-[#000666]" />
                  </div>
                  <div className="flex-1">
                    {currentAnswer.trim() ? (
                      <p className="text-sm text-[#191c1e] leading-relaxed">{currentAnswer}</p>
                    ) : (
                      <p className="text-sm text-[#767683] italic">Your answer will appear here...</p>
                    )}
                  </div>
                </div>

                {/* VoiceRecorder — persistent connection, VAD-driven */}
                <VoiceRecorder
                  ref={voiceRecorderRef}
                  onTranscript={handleTranscript}
                  disabled={isSubmittingAnswer}
                  onSpeechActivity={handleSpeechActivity}
                  isTTSSpeaking={isSpeaking}
                />

                {/* Clear Answer Button */}
                {currentAnswer.trim() && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={handleClearAnswer}
                      disabled={isSubmittingAnswer}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      Clear Answer
                    </button>
                  </div>
                )}
              </div>

              {/* Answer recorded indicator */}
              {currentAnswer.trim() && (
                <div className="mt-4 flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Answer recorded</span>
                </div>
              )}
            </div>
          )}

          {/* ===== Interview Complete Card ===== */}
          {isInterviewComplete && !isCompleting && (
            <div className="card p-8 mx-6 mt-4 text-center border-2 border-emerald-200 bg-emerald-50/50">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4 border border-emerald-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-[#191c1e] mb-2">All Questions Completed!</h2>
              <p className="text-sm text-[#767683] mb-1">
                You've answered {answeredCount} questions across all interview phases.
              </p>
              <p className="text-xs text-[#c6c5d4] mb-6">
                Click &quot;End Interview&quot; below to get your AI evaluation report.
              </p>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-sm font-semibold bg-[#000666] text-white hover:bg-[#4e45d5] transition-all shadow-md"
              >
                End Interview & Get Results
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ===== Sticky Bottom Controls ===== */}
        {!isInterviewComplete && currentQuestion && (
          <div className="sticky bottom-0 z-30 bg-white/90 backdrop-blur-md border-t border-[#e5e7eb]">
            <div className="px-6 py-4 flex items-center justify-between">
              {/* Left: Question counter */}
              <div className="flex items-center gap-2 text-sm text-[#767683]">
                <span className="font-medium">{answeredCount} answered</span>
                <span className="text-[#c6c5d4]">·</span>
                <span className="capitalize">{questionState?.interviewPhase || 'resume'} phase</span>
              </div>

              {/* Right: Submit Answer */}
              {isSubmittingAnswer ? (
                <div className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold bg-[#000666]/80 text-white">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI is thinking...
                </div>
              ) : (
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!currentAnswer.trim()}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all shadow-md ${
                    currentAnswer.trim()
                      ? 'bg-[#000666] text-white hover:bg-[#4e45d5]'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Submit Answer
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ===== Confirmation Modal ===== */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowConfirmModal(false)} />
          <div className="relative card p-8 max-w-md w-full text-center">
            <button
              onClick={() => setShowConfirmModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-[#767683] hover:text-[#191c1e] hover:bg-gray-100 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5 border border-red-100">
              <AlertTriangle className="w-8 h-8 text-[#ba1a1a]" />
            </div>

            <h3 className="text-xl font-bold text-[#191c1e] mb-2">End Interview?</h3>
            <p className="text-sm text-[#767683] mb-2">
              {isInterviewComplete
                ? 'Your interview is complete. Submit for AI evaluation?'
                : 'Are you sure you want to end the interview early?'}
            </p>
            {!isInterviewComplete && (
              <p className="text-xs text-amber-600 font-medium mb-4">
                Some question phases may not be completed yet.
              </p>
            )}

            <div className="card-flat p-4 rounded-xl mb-6 flex items-center justify-around text-center">
              <div>
                <p className="text-lg font-bold text-[#191c1e]">{answeredCount}</p>
                <p className="text-xs text-[#767683]">Answered</p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div>
                <p className="text-lg font-bold text-[#191c1e] capitalize">{questionState?.interviewPhase || 'resume'}</p>
                <p className="text-xs text-[#767683]">Phase</p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div>
                <p className="text-lg font-bold font-mono text-[#191c1e]">{formatTimer(timerSeconds)}</p>
                <p className="text-xs text-[#767683]">Duration</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowConfirmModal(false)} className="btn-secondary flex-1 py-3 text-sm rounded-full">
                Continue
              </button>
              <button
                onClick={handleEndInterview}
                className="flex-1 py-3 rounded-full text-sm font-semibold bg-[#ba1a1a] text-white hover:bg-red-700 transition-all flex items-center justify-center gap-2"
              >
                End Interview
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewPage;
