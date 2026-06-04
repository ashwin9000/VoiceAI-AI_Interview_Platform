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
  ExternalLink, ThumbsUp, BrainCircuit, ArrowRight
} from 'lucide-react';

const ResultsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const reportRef = useRef(null);
  const [report, setReport] = useState(null);
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleDownloadPDF = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      html2pdf().set({
        margin: 0.5,
        filename: `interview-report-${interview?.role || 'report'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      }).from(reportRef.current).save();
      toast.success('PDF download started!');
    } catch { toast.error('Failed to generate PDF'); }
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

          {/* ── Bottom Action Buttons ── */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border-2 border-[#e5e7eb] text-sm font-semibold text-[#191c1e] bg-white hover:border-[#4e45d5] hover:text-[#4e45d5] transition-colors w-full sm:w-auto justify-center"
            >
              <Download className="w-4 h-4" /> Download Report PDF
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
