import { Link, useNavigate } from 'react-router-dom';
import { Home, LayoutDashboard, ArrowLeft } from 'lucide-react';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="page-enter min-h-screen bg-[#f7f9fb] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-violet-200/15 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-blue-200/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Back link */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium text-[#767683] hover:text-[#000666] transition-colors mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Go back
        </button>

        {/* Card */}
        <div className="card p-10 sm:p-12 text-center">
          {/* Logo with float animation */}
          <div className="flex justify-center mb-8">
            <img
              src="/assets/logo.png"
              alt="VoiceAI"
              className="w-20 h-20 object-contain animate-float"
            />
          </div>

          {/* 404 */}
          <h1 className="text-7xl sm:text-8xl font-bold gradient-text font-display mb-3 leading-none">
            404
          </h1>

          {/* Title */}
          <h2 className="text-2xl font-bold text-[#191c1e] mb-3">
            Page Not Found
          </h2>

          {/* Description */}
          <p className="text-sm text-[#767683] leading-relaxed mb-8 max-w-sm mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Let&apos;s get you back on track.
          </p>

          {/* Navigation buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="btn-primary rounded-full w-full sm:w-auto"
            >
              <LayoutDashboard className="w-4 h-4" />
              Go to Dashboard
            </Link>
            <Link
              to="/"
              className="btn-secondary rounded-full w-full sm:w-auto"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>

        {/* Footer text */}
        <p className="text-center text-xs text-[#c6c5d4] mt-6">
          VoiceAI — AI-Powered Interview Platform
        </p>
      </div>
    </div>
  );
};

export default NotFoundPage;
