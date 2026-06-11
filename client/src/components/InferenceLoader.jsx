import { useState, useEffect } from 'react';
import { Cpu, Zap, CheckCircle2, Server } from 'lucide-react';

/**
 * InferenceLoader — An immersive, animated loading screen shown while
 * the local Llama.cpp server is inferencing on the resume.
 *
 * Features a neural-network-inspired animation with pulsing nodes,
 * a dynamic progress stepper, and rotating status messages.
 */

const TIPS = [
  'Your resume never leaves this machine.',
  'Running on-device AI — no cloud dependency.',
  'Local inference means zero data leakage.',
  'The model is parsing your skills & experience.',
  'Extracting projects, education & highlights.',
  'Building a candidate profile for the interview.',
];

const InferenceLoader = ({ steps = [], currentStep = 0 }) => {
  const [tipIndex, setTipIndex] = useState(0);
  const [tipFade, setTipFade] = useState(true);

  // Rotate tips every 3.5s with a fade transition
  useEffect(() => {
    const interval = setInterval(() => {
      setTipFade(false);
      setTimeout(() => {
        setTipIndex((prev) => (prev + 1) % TIPS.length);
        setTipFade(true);
      }, 300);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const progress = steps.length > 0
    ? Math.min(((currentStep + 1) / steps.length) * 100, 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
      <div className="flex flex-col items-center max-w-md w-full px-6">

        {/* ── Neural orb animation ─────────────────────────── */}
        <div className="relative w-40 h-40 mb-10">
          {/* Outer pulsing rings */}
          <div className="absolute inset-0 rounded-full border-2 border-indigo-200 inference-ring-1" />
          <div className="absolute inset-2 rounded-full border-2 border-indigo-300/50 inference-ring-2" />
          <div className="absolute inset-4 rounded-full border border-indigo-200/40 inference-ring-3" />

          {/* Core glow */}
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-[#1a1a5e] via-[#4338ca] to-[#6366f1] shadow-[0_0_60px_rgba(99,102,241,0.35)] inference-core" />

          {/* Inner icon */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <img src="/assets/logo.png" alt="VoiceAI" className="w-12 h-12 object-contain drop-shadow-lg" />
          </div>

          {/* Orbiting particles */}
          <div className="absolute inset-0 inference-orbit">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
            </div>
          </div>
          <div className="absolute inset-0 inference-orbit-reverse">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1">
              <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
            </div>
          </div>
          <div className="absolute inset-0 inference-orbit-slow">
            <div className="absolute top-1/2 right-0 translate-x-1 -translate-y-1/2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.8)]" />
            </div>
          </div>
        </div>

        {/* ── Title & badge ────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
            <Server className="w-3 h-3 text-emerald-600" />
            <span className="text-[0.65rem] font-semibold text-emerald-700 uppercase tracking-wider">
              Local Inference
            </span>
          </div>
        </div>

        <h2 className="text-xl font-bold text-[#191c1e] font-display mb-1">
          Inferencing Locally
        </h2>
        <p className="text-sm text-[#767683] mb-8 text-center">
          Your resume is being analyzed by the on-device AI model
        </p>

        {/* ── Progress bar ─────────────────────────────────── */}
        <div className="w-full mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#454652]">Processing</span>
            <span className="text-xs font-mono text-[#767683]">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1a1a5e] via-[#4338ca] to-[#6366f1] transition-all duration-700 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              {/* Shimmer overlay */}
              <div className="absolute inset-0 inference-shimmer" />
            </div>
          </div>
        </div>

        {/* ── Step checklist ────────────────────────────────── */}
        <div className="space-y-3 w-full mb-8">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 transition-all duration-500 ${
                i <= currentStep ? 'opacity-100' : 'opacity-35'
              }`}
            >
              {i < currentStep ? (
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              ) : i === currentStep ? (
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5 text-[#4338ca] animate-pulse" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-[#d1d5db] shrink-0" />
              )}
              <span className={`text-sm font-medium ${
                i < currentStep
                  ? 'text-emerald-700'
                  : i === currentStep
                    ? 'text-[#1a1a5e]'
                    : 'text-[#9ca3af]'
              }`}>
                {step}
              </span>
            </div>
          ))}
        </div>

        {/* ── Rotating tip ─────────────────────────────────── */}
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-indigo-50/60 border border-indigo-100 w-full">
          <Cpu className="w-4 h-4 text-[#4338ca] shrink-0 mt-0.5" />
          <p
            className={`text-xs text-[#4338ca] leading-relaxed transition-opacity duration-300 ${
              tipFade ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {TIPS[tipIndex]}
          </p>
        </div>

      </div>
    </div>
  );
};

export default InferenceLoader;
