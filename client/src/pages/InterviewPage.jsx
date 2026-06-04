import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { interviewAPI } from '../services/api';

import LoadingSpinner from '../components/LoadingSpinner';
import VoiceRecorder from '../components/VoiceRecorder';
import toast from 'react-hot-toast';
import {
  BrainCircuit, ChevronLeft, ChevronRight, AlertTriangle,
  X, CheckCircle2, Mic, ArrowRight, Clock, SkipForward,
  RotateCcw, User, Check
} from 'lucide-react';

const InterviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    const fetchInterview = async () => {
      try {
        const response = await interviewAPI.getById(id);
        const data = response.data.data;
        setInterview(data);
        setAnswers(new Array(data.questions?.length || 0).fill(''));
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

  useEffect(() => {
    if (interview && !isCompleting) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [interview, isCompleting]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const questions = interview?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const answeredCount = answers.filter(a => a && a.trim().length > 0).length;

  const handleTranscript = useCallback((text) => {
    setAnswers(prev => {
      const updated = [...prev];
      updated[currentQuestionIndex] = text;
      return updated;
    });
  }, [currentQuestionIndex]);

  const goToPrev = () => { if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1); };
  const goToNext = () => { if (currentQuestionIndex < totalQuestions - 1) setCurrentQuestionIndex(prev => prev + 1); };
  const goToQuestion = (index) => { setCurrentQuestionIndex(index); };

  const handleEndInterview = async () => {
    setShowConfirmModal(false);
    setIsCompleting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const submissionAnswers = questions.map((q, i) => ({
        questionId: q._id || q.id || i,
        answer: answers[i] || '',
        skipped: !answers[i] || answers[i].trim().length === 0,
      }));

      await interviewAPI.complete(id, { answers: submissionAnswers, duration: timerSeconds });
      toast.success('Interview completed! Viewing results...');
      navigate(`/results/${id}`);
    } catch (err) {
      const message = err.response?.data?.error || 'Failed to submit interview.';
      toast.error(message);
      setIsCompleting(false);
      timerRef.current = setInterval(() => { setTimerSeconds(prev => prev + 1); }, 1000);
    }
  };

  const getTypeColor = (t) => {
    switch (t?.toLowerCase()) {
      case 'technical': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'behavioral': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'conceptual': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'resume-based': return 'bg-pink-50 text-pink-700 border-pink-200';
      default: return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
  };

  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const currentAnswerFilled = answers[currentQuestionIndex] && answers[currentQuestionIndex].trim().length > 0;

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
            <p className="text-sm text-[#767683] mb-1">Analyzing {answeredCount} of {totalQuestions} answers...</p>
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
            <div className="flex items-center gap-2 bg-[#f7f9fb] border border-[#e5e7eb] rounded-full px-4 py-1.5">
              <Clock className="w-4 h-4 text-[#000666]" />
              <span className="text-sm font-mono font-semibold text-[#191c1e] tracking-wider">
                {formatTimer(timerSeconds)}
              </span>
            </div>
          </div>
        </div>

        {/* ===== Scrollable Content ===== */}
        <div className="flex-1 overflow-y-auto pb-24">
          {/* AI Avatar Area */}
          <div className="mx-6 mt-6 rounded-2xl bg-gradient-to-br from-cyan-100 via-purple-100 to-blue-100 min-h-[300px] relative flex items-center justify-center overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-12 -left-12 w-48 h-48 bg-cyan-200/40 rounded-full blur-2xl" />
              <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-purple-200/40 rounded-full blur-2xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-200/30 rounded-full blur-3xl" />
            </div>

            {/* AI Bot Icon */}
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-3xl bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center border border-white/60">
                <BrainCircuit className="w-12 h-12 text-[#000666]" />
              </div>
              <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-full px-4 py-1.5 border border-white/50">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-[#191c1e]">AI Interviewer Active</span>
              </div>
            </div>

            {/* Webcam feed simulation – top-right */}
            <div className="absolute top-4 right-4 w-20 h-20 rounded-xl bg-[#191c1e]/80 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-md">
              <User className="w-8 h-8 text-white/70" />
            </div>
          </div>

          {/* Question Card */}
          <div className="card p-6 mx-6 -mt-8 relative z-10">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold tracking-wider text-indigo-600 uppercase">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </span>
              {currentQuestion?.type && (
                <span className={`text-xs font-medium px-3 py-1 rounded-full border ${getTypeColor(currentQuestion.type)}`}>
                  {currentQuestion.type}
                </span>
              )}
            </div>

            {/* Question text */}
            <p className="text-lg sm:text-xl font-bold text-[#191c1e] leading-relaxed mb-6">
              &ldquo;{currentQuestion?.question || currentQuestion?.text || 'Question not available.'}&rdquo;
            </p>

            {/* Answer input area */}
            <div className="bg-[#f7f9fb] rounded-xl p-5 border border-[#e5e7eb]">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-[#eef2ff] flex items-center justify-center flex-shrink-0">
                  <Mic className="w-4 h-4 text-[#000666]" />
                </div>
                <div className="flex-1">
                  {currentAnswerFilled ? (
                    <p className="text-sm text-[#191c1e] leading-relaxed">{answers[currentQuestionIndex]}</p>
                  ) : (
                    <p className="text-sm text-[#767683] italic">Your answer will appear here...</p>
                  )}
                </div>
              </div>

              {/* VoiceRecorder */}
              <VoiceRecorder
                key={currentQuestionIndex}
                onTranscript={handleTranscript}
                disabled={isCompleting}
              />
            </div>

            {/* Saved answer indicator */}
            {currentAnswerFilled && (
              <div className="mt-4 flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Answer recorded</span>
              </div>
            )}
          </div>

          {/* Question dots navigation */}
          <div className="flex items-center justify-center gap-1.5 mt-6 mb-4 flex-wrap px-6">
            {questions.map((_, i) => {
              const isAnswered = answers[i] && answers[i].trim().length > 0;
              const isCurrent = i === currentQuestionIndex;
              return (
                <button
                  key={i}
                  onClick={() => goToQuestion(i)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    isCurrent
                      ? 'bg-[#000666] scale-125 shadow-md'
                      : isAnswered
                      ? 'bg-emerald-400 hover:bg-emerald-500'
                      : 'bg-gray-200 hover:bg-gray-300'
                  }`}
                  title={`Question ${i + 1}${isAnswered ? ' (answered)' : ''}`}
                />
              );
            })}
          </div>
        </div>

        {/* ===== Sticky Bottom Controls ===== */}
        <div className="sticky bottom-0 z-30 bg-white/90 backdrop-blur-md border-t border-[#e5e7eb]">
          <div className="px-6 py-4 flex items-center justify-between">
            {/* Left: Repeat Question */}
            <button
              onClick={goToPrev}
              disabled={currentQuestionIndex === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all border ${
                currentQuestionIndex === 0
                  ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                  : 'bg-white text-[#191c1e] border-[#e5e7eb] hover:bg-gray-50'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Repeat Question</span>
            </button>

            {/* Right: Next / Complete / End */}
            {isLastQuestion ? (
              <button
                onClick={() => setShowConfirmModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold bg-[#000666] text-white hover:bg-[#4e45d5] transition-all shadow-md"
              >
                End Interview
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : currentAnswerFilled ? (
              <button
                onClick={goToNext}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold bg-[#000666] text-white hover:bg-[#4e45d5] transition-all shadow-md"
              >
                Next Question
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={goToNext}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold bg-[#000666] text-white hover:bg-[#4e45d5] transition-all shadow-md"
              >
                Complete Answer
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
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
            <p className="text-sm text-[#767683] mb-2">Are you sure you want to end this interview?</p>
            <p className="text-xs text-[#c6c5d4] mb-6">
              {totalQuestions - answeredCount > 0 && (
                <>
                  <span className="text-amber-600 font-medium">{totalQuestions - answeredCount}</span>
                  {' '}unanswered question{totalQuestions - answeredCount !== 1 ? 's' : ''} will be marked as skipped.
                </>
              )}
              {totalQuestions - answeredCount === 0 && 'All questions have been answered.'}
            </p>

            <div className="card-flat p-4 rounded-xl mb-6 flex items-center justify-around text-center">
              <div>
                <p className="text-lg font-bold text-[#191c1e]">{answeredCount}</p>
                <p className="text-xs text-[#767683]">Answered</p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div>
                <p className="text-lg font-bold text-[#191c1e]">{totalQuestions - answeredCount}</p>
                <p className="text-xs text-[#767683]">Skipped</p>
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
