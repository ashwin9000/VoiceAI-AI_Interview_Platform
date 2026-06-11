import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-hero relative">
      {/* ===== NAVBAR ===== */}
      <nav className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img src="/assets/logo.png" alt="VoiceAI" className="w-9 h-9 rounded-xl object-contain" />
            <span className="text-lg font-bold text-[#000666]">VoiceAI</span>
          </div>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/dashboard" className="text-sm font-medium text-[#454652] hover:text-[#000666] transition-colors">Dashboard</Link>
            <Link to="/start-interview" className="text-sm font-medium text-[#454652] hover:text-[#000666] transition-colors">Start Interview</Link>
            <Link to="/profile" className="text-sm font-medium text-[#454652] hover:text-[#000666] transition-colors">Profile</Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary text-sm py-2.5 px-6 rounded-full">
                Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-[#000666] hover:text-[#4e45d5] transition-colors">
                  Sign In
                </Link>
                <Link to="/signup" className="btn-primary text-sm py-2.5 px-6 rounded-full">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <div className="animate-fade-in-up">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#eef2ff] border border-[#e0e0ff] mb-8">
              <Sparkles className="w-4 h-4 text-[#4e45d5]" />
              <span className="text-sm font-medium text-[#000666]">Next-Gen Assessment Engine</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl font-bold text-[#191c1e] leading-tight mb-6">
              Master your next{' '}
              <br className="hidden sm:block" />
              interview with{' '}
              <span className="text-[#4e45d5]">Machine{' '}<br className="hidden sm:block" />Intelligence.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-[#454652] leading-relaxed mb-10 max-w-lg">
              Experience highly realistic, professional mock interviews powered by
              advanced analytical intelligence. Get instant, actionable feedback to
              land your dream role in tech, finance, or consulting.
            </p>

            {/* CTA Buttons */}
            <div className="flex items-center gap-4 mb-12">
              <Link
                to={isAuthenticated ? '/start-interview' : '/signup'}
                className="btn-primary py-3.5 px-8 rounded-full text-base"
              >
                Sign Up Free
              </Link>
              <Link
                to="/login"
                className="btn-secondary py-3.5 px-8 rounded-full text-base"
              >
                Sign In
              </Link>
            </div>

            {/* Trust Badge */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {['#6366f1', '#4e45d5', '#000666'].map((color, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: color }}
                  >
                    {['A', 'S', 'K'][i]}
                  </div>
                ))}
              </div>
              <span className="text-sm text-[#454652]">Trusted by 10,000+ candidates</span>
            </div>
          </div>

          {/* Right: AI Interview Preview Card */}
          <div className="hidden lg:flex justify-center animate-fade-in stagger-2" style={{ animationFillMode: 'both' }}>
            <div className="w-full max-w-md">
              <div className="card p-6 rounded-2xl">
                <div className="bg-[#f7f9fb] rounded-xl p-6 min-h-[240px] flex flex-col justify-end">
                  {/* AI Active Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-sm font-semibold text-[#191c1e]">AI Interviewer Active</span>
                    </div>
                    <span className="text-sm font-mono text-[#454652]">04:12</span>
                  </div>

                  {/* Waveform */}
                  <div className="flex items-end gap-1 mb-4 h-8">
                    {[12, 20, 8, 16, 24, 10, 18, 14, 22, 6, 16, 20, 10, 14, 8].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-[#000666] rounded-full transition-all"
                        style={{ height: `${h}px`, opacity: 0.7 + (i % 3) * 0.1 }}
                      />
                    ))}
                  </div>

                  {/* Question Text */}
                  <p className="text-sm text-[#191c1e] leading-relaxed">
                    "That's a great example of resolving team conflict. Can you
                    elaborate on the specific metrics you used to measure the
                    success of that resolution?"
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-gray-100 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <img src="/assets/logo.png" alt="VoiceAI" className="w-5 h-5 object-contain" />
                <span className="text-sm font-bold text-[#000666]">VoiceAI</span>
              </div>
              <p className="text-xs text-[#767683]">
                © 2024 VoiceAI Platform. Empowering human potential
                <br />through analytical intelligence.
              </p>
            </div>
            <div className="flex items-center gap-6">
              {['Privacy Policy', 'Terms of Service', 'Contact Support', 'API Documentation'].map((link) => (
                <a key={link} href="#" className="text-xs text-[#767683] hover:text-[#000666] transition-colors">
                  {link}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
