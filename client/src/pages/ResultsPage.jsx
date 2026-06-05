import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { reportAPI, interviewAPI } from '../services/api';
import Sidebar from '../components/Sidebar';
import toast from 'react-hot-toast';
import ScoreCircle from '../components/ScoreCircle';
import ScoreBar from '../components/ScoreBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { getGrade } from '../utils/constants';
import {
  Trophy, Download, RotateCcw, LayoutDashboard,
  CheckCircle2, AlertTriangle, TrendingUp, BookOpen, Award,
  Clock, Brain, MessageSquare, Lightbulb, Shield, Target, Users,
  ExternalLink, ThumbsUp, BrainCircuit, ArrowRight, Loader2,
  User, FileText
} from 'lucide-react';

const ResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const reportRef = useRef(null);
  const [report, setReport] = useState(null);
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => { fetchResults(); }, [id]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      const [reportRes, interviewRes] = await Promise.all([
        reportAPI.getByInterviewId(id),
        interviewAPI.getById(id),
      ]);
      setReport(reportRes.data.data);
      setInterview(interviewRes.data.data);
    } catch (err) {
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Build Q&A pairs from interview questions and answers.
   */
  const getQAPairs = () => {
    if (!interview?.questions || !interview?.answers) return [];
    return interview.questions.map((q, index) => {
      const answer = interview.answers.find((a) => a.questionIndex === index);
      return {
        index: index + 1,
        question: q.text,
        type: q.type || 'general',
        difficulty: q.difficulty || 'medium',
        isFollowUp: q.isFollowUp || false,
        answer: answer ? answer.text : null,
        skipped: !answer,
      };
    });
  };

  const getTypeColor = (t) => {
    switch (t?.toLowerCase()) {
      case 'technical': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'behavioral': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'conceptual': return 'bg-cyan-100 text-cyan-700 border-cyan-200';
      case 'resume-based': return 'bg-pink-100 text-pink-700 border-pink-200';
      default: return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
  };

  const handleDownloadPDF = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default || html2pdfModule;

      const element = reportRef.current;
      if (!element) {
        toast.error('Report content not found');
        setIsDownloading(false);
        return;
      }

      // --- Resolve oklch → hex using Canvas 2D context ---
      // html2canvas can't parse oklch() color functions from Tailwind CSS v4.
      // Modern Chrome (111+) returns oklch from getComputedStyle as-is, so we
      // force-convert via the canvas fillStyle setter (always returns sRGB hex).
      const resolveColor = (cssColor) => {
        if (!cssColor || typeof cssColor !== 'string') return cssColor;
        if (!/oklch|oklab|lch\(|lab\(|color\(/.test(cssColor)) return cssColor;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#000000'; // reset baseline
          ctx.fillStyle = cssColor;  // browser converts to sRGB
          return ctx.fillStyle;      // getter always returns hex
        } catch {
          return '#000000';
        }
      };

      const COLOR_PROPS = [
        'color', 'backgroundColor', 'borderColor',
        'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
        'outlineColor', 'textDecorationColor',
      ];

      // Pre-compute a color map from the LIVE DOM (before html2canvas clones it).
      // Each entry maps index → { prop: resolvedHexColor }.
      const originalEls = [element, ...element.querySelectorAll('*')];
      const colorMap = originalEls.map((el) => {
        const computed = window.getComputedStyle(el);
        const resolved = {};
        COLOR_PROPS.forEach((prop) => {
          const val = computed[prop];
          if (val) resolved[prop] = resolveColor(val);
        });
        return resolved;
      });

      const opt = {
        margin: [0.4, 0.4, 0.4, 0.4],
        filename: `interview-report-${interview?.role || 'report'}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          onclone: (_clonedDoc, clonedElement) => {
            // Apply pre-computed hex colors as inline styles on html2canvas's
            // internal clone. Inline styles override stylesheet oklch values,
            // so the parser only sees hex/rgb — no more oklch errors.
            const clonedEls = [clonedElement, ...clonedElement.querySelectorAll('*')];
            clonedEls.forEach((el, i) => {
              if (!colorMap[i]) return;
              Object.entries(colorMap[i]).forEach(([prop, val]) => {
                if (val) el.style[prop] = val;
              });
            });

            // Remove SVG icons — they cause html2canvas rendering glitches
            clonedElement.querySelectorAll('svg').forEach((svg) => svg.remove());
          },
        },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      await html2pdf().set(opt).from(element).save();
      toast.success('PDF downloaded successfully!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      // Clean up any stale html2canvas clones/containers that could block the page
      document.querySelectorAll('.html2canvas-container, [data-html2canvas-clone]').forEach((el) => el.remove());
      setIsDownloading(false);
    }
  };

  const formatDuration = (s) => {
    if (!s) return '0';
    return `${Math.floor(s / 60)}`;
  };

  const formatDurationFull = (s) => {
    if (!s) return '0:00';
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="page-enter min-h-screen bg-[#f7f9fb]">
        <Sidebar activePath="/results" />
        <main className="md:ml-[220px] min-h-screen flex items-center justify-center p-6 md:p-8">
          <LoadingSpinner size="lg" text="Loading your results..." />
        </main>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="page-enter min-h-screen bg-[#f7f9fb]">
        <Sidebar activePath="/results" />
        <main className="md:ml-[220px] min-h-screen flex items-center justify-center p-6 md:p-8">
          <div className="text-center">
            <p className="text-[#767683] mb-4">Report not found</p>
            <Link to="/dashboard" className="inline-flex items-center gap-2 bg-[#000666] text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-[#4e45d5] transition-colors">
              <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const gradeInfo = getGrade(report.overallScore);
  const qaPairs = getQAPairs();

  const getPercentile = (score) => {
    if (score >= 95) return 5;
    if (score >= 90) return 10;
    if (score >= 85) return 15;
    if (score >= 80) return 20;
    if (score >= 70) return 30;
    if (score >= 60) return 40;
    return 50;
  };

  const chipColors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700',
    'bg-cyan-100 text-cyan-700',
    'bg-indigo-100 text-indigo-700',
    'bg-rose-100 text-rose-700',
  ];

  return (
    <div className="page-enter min-h-screen bg-[#f7f9fb]">
      <Sidebar activePath="/results" />

      <main className="md:ml-[220px] min-h-screen p-6 md:p-8">
        <div className="max-w-5xl mx-auto" ref={reportRef}>

          {/* ── Title ── */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-[#191c1e]">
              Interview Results: {interview?.role}
            </h1>
            <p className="text-[#767683] text-sm mt-1">
              Completed on {new Date(interview?.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* ── Three Stat Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {/* Overall Score */}
            <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 flex flex-col items-center justify-center">
              <p className="text-xs font-semibold text-[#767683] uppercase tracking-wider mb-3">Overall Score</p>
              <ScoreCircle score={report.overallScore} size={120} />
            </div>

            {/* Grade */}
            <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 flex flex-col items-center justify-center">
              <p className="text-xs font-semibold text-[#767683] uppercase tracking-wider mb-3">Grade</p>
              <span className={`text-5xl font-bold ${gradeInfo.color}`}>{gradeInfo.grade}</span>
              <span className="mt-3 inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-1 rounded-full border border-amber-200">
                <Award className="w-3.5 h-3.5" /> Top {getPercentile(report.overallScore)}% of candidates
              </span>
            </div>

            {/* Duration */}
            <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6 flex flex-col items-center justify-center">
              <p className="text-xs font-semibold text-[#767683] uppercase tracking-wider mb-3">Duration</p>
              <div className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-[#4e45d5]" />
                <span className="text-4xl font-bold text-[#191c1e]">{formatDuration(interview?.duration)}</span>
              </div>
              <span className="text-sm text-[#767683] mt-1">Minutes</span>
            </div>
          </div>

          {/* ── Performance Analytics ── */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#191c1e] mb-5 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-[#4e45d5]" />
              Performance Analytics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
                <ScoreBar label="Technical Accuracy" score={report.sectionScores?.technical || 0} icon={Brain} delay={0} />
              </div>
              <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
                <ScoreBar label="Communication" score={report.sectionScores?.communication || 0} icon={MessageSquare} delay={100} />
              </div>
              <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
                <ScoreBar label="Problem Solving" score={report.sectionScores?.problemSolving || 0} icon={Lightbulb} delay={200} />
              </div>
              <div className="bg-white rounded-2xl border border-[#e5e7eb] p-5">
                <ScoreBar label="Confidence Score" score={report.sectionScores?.confidence || 0} icon={Shield} delay={300} />
              </div>
            </div>
          </div>

          {/* ── Interview Q&A Transcript ── */}
          {qaPairs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-[#191c1e] mb-5 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#4e45d5]" />
                Interview Q&A Transcript
              </h2>
              <div className="space-y-4">
                {qaPairs.map((pair) => (
                  <div
                    key={pair.index}
                    className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden"
                  >
                    {/* Question */}
                    <div className="px-5 py-4 border-b border-[#e5e7eb] bg-[#f9fafb]">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className="w-6 h-6 rounded-md bg-[#000666] flex items-center justify-center flex-shrink-0">
                          <BrainCircuit className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs font-bold text-[#191c1e] uppercase tracking-wider">
                          Q{pair.index}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getTypeColor(pair.type)}`}>
                          {pair.type}
                        </span>
                        {pair.isFollowUp && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                            Follow-up
                          </span>
                        )}
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-[#767683]">
                          {pair.difficulty}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[#191c1e] leading-relaxed">
                        {pair.question}
                      </p>
                    </div>
                    {/* Answer */}
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-md bg-[#f0f0f5] flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 text-[#767683]" />
                        </div>
                        <span className="text-xs font-bold text-[#767683] uppercase tracking-wider">
                          Your Answer
                        </span>
                        {pair.skipped ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                            Skipped
                          </span>
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                      </div>
                      {pair.skipped ? (
                        <p className="text-sm text-[#767683] italic">No answer provided</p>
                      ) : (
                        <p className="text-sm text-[#454652] leading-relaxed">{pair.answer}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Detailed AI Feedback ── */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-[#191c1e] mb-5">Detailed AI Feedback</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Strengths */}
              <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <ThumbsUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-bold text-emerald-800">Strengths</h3>
                </div>
                <ul className="space-y-2.5">
                  {(report.strengths || []).map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                  {(!report.strengths || report.strengths.length === 0) && (
                    <li className="text-sm text-emerald-400 italic">No strengths identified</li>
                  )}
                </ul>
              </div>

              {/* Areas of Concern */}
              <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                  <h3 className="text-sm font-bold text-red-800">Areas of Concern</h3>
                </div>
                <ul className="space-y-2.5">
                  {(report.weaknesses || []).map((w, i) => (
                    <li key={i} className="flex gap-2 text-sm text-red-900">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                  {(!report.weaknesses || report.weaknesses.length === 0) && (
                    <li className="text-sm text-red-400 italic">No concerns identified</li>
                  )}
                </ul>
              </div>

              {/* Growth Opportunities */}
              <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-bold text-blue-800">Growth Opportunities</h3>
                </div>
                <ul className="space-y-2.5">
                  {(report.recommendations || []).map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-blue-900">
                      <ArrowRight className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                  {(!report.recommendations || report.recommendations.length === 0) && (
                    <li className="text-sm text-blue-400 italic">No recommendations</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* ── Actionable Recommendations ── */}
          <div className="mb-10">
            <h2 className="text-lg font-bold text-[#191c1e] mb-5 flex items-center gap-2">
              <Target className="w-5 h-5 text-[#4e45d5]" />
              Actionable Recommendations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Topics to Review */}
              <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
                <h3 className="text-sm font-bold text-[#191c1e] mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#4e45d5]" />
                  Topics to Review
                </h3>
                <div className="flex flex-wrap gap-2">
                  {report.learningResources && report.learningResources.length > 0 ? (
                    report.learningResources.map((r, i) => (
                      <a
                        key={i}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-80 ${chipColors[i % chipColors.length]}`}
                      >
                        {r.topic}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))
                  ) : (
                    <p className="text-sm text-[#767683] italic">No topics suggested</p>
                  )}
                </div>
              </div>

              {/* Practice Suggestions */}
              <div className="bg-white rounded-2xl border border-[#e5e7eb] p-6">
                <h3 className="text-sm font-bold text-[#191c1e] mb-4 flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-[#4e45d5]" />
                  Practice Suggestions
                </h3>
                {report.feedback ? (
                  <p className="text-sm text-[#454652] leading-relaxed mb-4">{report.feedback}</p>
                ) : (
                  <p className="text-sm text-[#767683] italic mb-4">No additional feedback provided</p>
                )}
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4e45d5] hover:text-[#000666] transition-colors"
                >
                  View Study Materials <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

        {/* Close the reportRef div here — action buttons and footer are OUTSIDE the PDF content */}
        </div>

        {/* ── Bottom Action Buttons (outside reportRef so they don't appear in PDF) ── */}
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border-2 border-[#e5e7eb] text-sm font-semibold text-[#191c1e] bg-white hover:border-[#4e45d5] hover:text-[#4e45d5] transition-colors w-full sm:w-auto justify-center disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download Report PDF
                </>
              )}
            </button>
            <Link
              to="/start-interview"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border-2 border-[#e5e7eb] text-sm font-semibold text-[#191c1e] bg-white hover:border-[#4e45d5] hover:text-[#4e45d5] transition-colors w-full sm:w-auto justify-center"
            >
              <RotateCcw className="w-4 h-4" /> Retake Interview
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#000666] text-white text-sm font-semibold hover:bg-[#4e45d5] transition-colors w-full sm:w-auto justify-center"
            >
              <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
            </Link>
          </div>

          {/* ── Footer ── */}
          <footer className="border-t border-[#e5e7eb] pt-6 pb-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#000666] flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-[#191c1e]">AIVision</span>
              </div>
              <p className="text-xs text-[#767683]">
                © {new Date().getFullYear()} AIVision. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                <a href="#" className="text-xs text-[#767683] hover:text-[#4e45d5] transition-colors">Privacy Policy</a>
                <a href="#" className="text-xs text-[#767683] hover:text-[#4e45d5] transition-colors">Terms</a>
                <a href="#" className="text-xs text-[#767683] hover:text-[#4e45d5] transition-colors">Contact</a>
                <a href="#" className="text-xs text-[#767683] hover:text-[#4e45d5] transition-colors">API Docs</a>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default ResultsPage;
