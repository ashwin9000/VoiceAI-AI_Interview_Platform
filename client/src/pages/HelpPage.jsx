import { useState, useCallback, memo } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Rocket, BookOpen, HelpCircle, LayoutDashboard, PlayCircle,
  Mic, MessageSquare, BarChart3, ChevronDown, ChevronRight,
  UserPlus, Upload, BrainCircuit, Award, Shield, FileText,
  Globe, Volume2, Zap, Mail
} from 'lucide-react';

/* ── Quick Start Steps ──────────────────────────────────────────────── */

const STEPS = [
  {
    num: 1,
    title: 'Create Account',
    desc: 'Sign up with your email and password to get started.',
    icon: UserPlus,
  },
  {
    num: 2,
    title: 'Upload Resume',
    desc: 'Upload your PDF or DOCX resume for AI analysis.',
    icon: Upload,
  },
  {
    num: 3,
    title: 'Start Interview',
    desc: 'Choose a target role and begin your AI-powered interview.',
    icon: PlayCircle,
  },
  {
    num: 4,
    title: 'Get Results',
    desc: 'Receive detailed AI feedback, scores, and improvement areas.',
    icon: Award,
  },
];

/* ── Feature Deep Dives ─────────────────────────────────────────────── */

const FEATURES = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    content:
      'Your central hub for tracking interview performance. View overall statistics including total interviews, average scores, and recent activity. The dashboard provides a quick snapshot of your progress and direct access to start new interviews or review past results.',
  },
  {
    title: 'Starting an Interview',
    icon: PlayCircle,
    content:
      'Select your target role from our curated list of positions (Frontend Developer, Backend Developer, Data Scientist, and more) or enter a custom role. Upload your resume in PDF or DOCX format (up to 10MB). Our on-device AI analyzes your resume locally — your data never leaves your machine. The system extracts skills, experience, and projects to generate personalized interview questions tailored to your background.',
  },
  {
    title: 'Interview Experience',
    icon: Mic,
    content:
      'Questions progress through four distinct phases: Resume-Based, Technical, Conceptual, and Behavioral. The AI dynamically generates follow-up questions based on your answers, creating a realistic conversational interview flow. Use voice recording powered by AssemblyAI for hands-free answering, or type your responses. Enable AI voice (text-to-speech) to hear questions read aloud. A live timer and phase progress indicator keep you oriented throughout.',
  },
  {
    title: 'Interview Assistant',
    icon: MessageSquare,
    content:
      'Chat with our RAG-powered AI assistant about your past interviews. Ask about your performance trends, identify weak areas, request personalized study plans, or review specific questions from previous sessions. All responses are grounded in your actual interview data, providing accurate and actionable insights.',
  },
  {
    title: 'Results & Feedback',
    icon: BarChart3,
    content:
      'After completing an interview, receive a comprehensive AI evaluation. Your results include an overall percentage score, per-question feedback with individual scores, identified strengths, and specific areas for improvement. Use these insights to target your preparation and track progress over multiple interviews.',
  },
];

/* ── FAQ Items ───────────────────────────────────────────────────────── */

const FAQS = [
  {
    q: 'Is my data secure?',
    a: 'Absolutely. Resume analysis runs locally on-device using our AI model — your resume data never leaves your machine. All communications are encrypted end-to-end, and interview data is stored securely.',
  },
  {
    q: 'What file formats are supported?',
    a: 'We support PDF and DOCX formats for resume uploads. The maximum file size is 10MB. Our parser handles most standard resume layouts and extracts text, skills, experience, and project details.',
  },
  {
    q: 'How does the AI generate questions?',
    a: 'Our system parses your resume to understand your skills, experience, and project history. It then generates role-specific questions dynamically across four phases (Resume, Technical, Conceptual, Behavioral). Follow-up questions adapt based on your answers, creating a realistic interview flow.',
  },
  {
    q: 'Can I retake an interview?',
    a: 'Yes! You can start a new interview at any time from the Dashboard or Start Interview page. Each interview is independent, and you can track your progress across all attempts.',
  },
  {
    q: 'What browsers are supported?',
    a: 'VoiceAI works best on modern browsers including Chrome, Firefox, Edge, and Safari. Voice recording requires Web Audio API support, which is available in all major browsers. For the best experience, we recommend using the latest version of Chrome.',
  },
  {
    q: 'How is my interview scored?',
    a: 'Our AI evaluates each answer based on relevance to the question, depth of explanation, technical accuracy, and communication clarity. You receive an overall score (0–100) and individual question scores with specific written feedback.',
  },
];

/* ── Memoized Sub-components ─────────────────────────────────────────── */

const StepCard = memo(({ step }) => {
  const Icon = step.icon;
  return (
    <div className="card p-6 text-center group hover:border-[#bdc2ff] transition-all duration-200">
      <div className="w-12 h-12 rounded-full bg-[#eef2ff] flex items-center justify-center mx-auto mb-4 group-hover:bg-[#000666] transition-colors">
        <Icon className="w-5 h-5 text-[#000666] group-hover:text-white transition-colors" />
      </div>
      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#000666] text-white text-xs font-bold mb-3">
        {step.num}
      </div>
      <h3 className="text-sm font-bold text-[#191c1e] mb-1.5">{step.title}</h3>
      <p className="text-xs text-[#767683] leading-relaxed">{step.desc}</p>
    </div>
  );
});
StepCard.displayName = 'StepCard';

const FeatureItem = memo(({ feature, isOpen, onToggle }) => {
  const Icon = feature.icon;
  return (
    <div className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-[#f7f9fb] transition-colors"
      >
        <div className="icon-box flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <span className="flex-1 text-sm font-semibold text-[#191c1e]">
          {feature.title}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[#767683] transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
        <div className="px-5 pb-5 pl-[76px]">
          <p className="text-sm text-[#454652] leading-relaxed">
            {feature.content}
          </p>
        </div>
      </div>
    </div>
  );
});
FeatureItem.displayName = 'FeatureItem';

const FaqItem = memo(({ faq, isOpen, onToggle }) => (
  <div className="card overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 p-5 text-left hover:bg-[#f7f9fb] transition-colors"
    >
      <ChevronRight
        className={`w-4 h-4 text-[#000666] flex-shrink-0 transition-transform duration-300 ${
          isOpen ? 'rotate-90' : ''
        }`}
      />
      <span className="flex-1 text-sm font-semibold text-[#191c1e]">
        {faq.q}
      </span>
    </button>
    <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
      <div className="px-5 pb-5 pl-11">
        <p className="text-sm text-[#454652] leading-relaxed">{faq.a}</p>
      </div>
    </div>
  </div>
));
FaqItem.displayName = 'FaqItem';

/* ── Help Page ───────────────────────────────────────────────────────── */

const HelpPage = () => {
  const [openFeature, setOpenFeature] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFeature = useCallback((idx) => {
    setOpenFeature((prev) => (prev === idx ? null : idx));
  }, []);

  const toggleFaq = useCallback((idx) => {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  }, []);

  return (
    <>
      <Sidebar activePath="/help" />
      <div className="page-enter min-h-screen bg-[#f7f9fb]">
        <main className="md:ml-[220px] pt-16 md:pt-0">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">

            {/* ── Header ──────────────────────────────────────────── */}
            <div className="mb-12">
              <div className="flex items-center gap-3 mb-3">
                <div className="icon-box">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-[#191c1e] font-display">
                    Help Center
                  </h1>
                  <p className="text-sm text-[#767683]">
                    Everything you need to know about VoiceAI
                  </p>
                </div>
              </div>
            </div>

            {/* ── Quick Start Guide ───────────────────────────────── */}
            <section className="mb-12">
              <div className="flex items-center gap-2.5 mb-5">
                <Rocket className="w-5 h-5 text-[#000666]" />
                <h2 className="text-xl font-bold text-[#191c1e]">
                  Getting Started
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {STEPS.map((step) => (
                  <StepCard key={step.num} step={step} />
                ))}
              </div>
            </section>

            {/* ── Platform Features ───────────────────────────────── */}
            <section className="mb-12">
              <div className="flex items-center gap-2.5 mb-5">
                <BookOpen className="w-5 h-5 text-[#000666]" />
                <h2 className="text-xl font-bold text-[#191c1e]">
                  Platform Features
                </h2>
              </div>
              <div className="space-y-3">
                {FEATURES.map((feature, idx) => (
                  <FeatureItem
                    key={feature.title}
                    feature={feature}
                    isOpen={openFeature === idx}
                    onToggle={() => toggleFeature(idx)}
                  />
                ))}
              </div>
            </section>

            {/* ── FAQ ─────────────────────────────────────────────── */}
            <section className="mb-12">
              <div className="flex items-center gap-2.5 mb-5">
                <HelpCircle className="w-5 h-5 text-[#000666]" />
                <h2 className="text-xl font-bold text-[#191c1e]">
                  Frequently Asked Questions
                </h2>
              </div>
              <div className="space-y-3">
                {FAQS.map((faq, idx) => (
                  <FaqItem
                    key={faq.q}
                    faq={faq}
                    isOpen={openFaq === idx}
                    onToggle={() => toggleFaq(idx)}
                  />
                ))}
              </div>
            </section>

            {/* ── Key Highlights ──────────────────────────────────── */}
            <section className="mb-12">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card-flat p-5 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#191c1e] mb-1">
                      Privacy First
                    </h3>
                    <p className="text-xs text-[#767683] leading-relaxed">
                      On-device AI processing ensures your resume data stays private.
                    </p>
                  </div>
                </div>
                <div className="card-flat p-5 flex items-start gap-3">
                  <Zap className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#191c1e] mb-1">
                      AI-Powered
                    </h3>
                    <p className="text-xs text-[#767683] leading-relaxed">
                      Dynamic question generation that adapts to your unique profile.
                    </p>
                  </div>
                </div>
                <div className="card-flat p-5 flex items-start gap-3">
                  <Volume2 className="w-5 h-5 text-[#4e45d5] flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#191c1e] mb-1">
                      Voice Enabled
                    </h3>
                    <p className="text-xs text-[#767683] leading-relaxed">
                      Speak your answers naturally with real-time transcription.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Support CTA ─────────────────────────────────────── */}
            <section className="mb-6">
              <div className="card-flat p-8 text-center">
                <Mail className="w-8 h-8 text-[#000666] mx-auto mb-3" />
                <h3 className="text-lg font-bold text-[#191c1e] mb-2">
                  Still need help?
                </h3>
                <p className="text-sm text-[#767683] mb-1 max-w-md mx-auto">
                  If you can&apos;t find what you&apos;re looking for, our team is here to
                  assist you. Reach out and we&apos;ll get back to you shortly.
                </p>
                <p className="text-sm font-semibold text-[#4e45d5]">
                  support@voiceai.app
                </p>
              </div>
            </section>

          </div>
        </main>
      </div>
    </>
  );
};

export default HelpPage;
