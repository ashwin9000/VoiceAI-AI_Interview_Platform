import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

// Pages
import LandingPage from './pages/LandingPage';
import SignUpPage from './pages/SignUpPage';
import SignInPage from './pages/SignInPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import StartInterviewPage from './pages/StartInterviewPage';
import InterviewPage from './pages/InterviewPage';
import ResultsPage from './pages/ResultsPage';
import ChatPage from './pages/ChatPage';

// Lazy-loaded pages (non-critical path — bundle optimization)
const HelpPage = lazy(() => import('./pages/HelpPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const LazyFallback = () => (
  <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center">
    <LoadingSpinner size="lg" text="Loading..." />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              color: '#191c1e',
              borderRadius: '12px',
              fontSize: '14px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            },
            success: {
              iconTheme: {
                primary: '#059669',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ba1a1a',
                secondary: '#fff',
              },
            },
          }}
        />

        {/* Routes — each page handles its own navigation */}
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<SignInPage />} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/start-interview"
            element={
              <ProtectedRoute>
                <StartInterviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview/:id"
            element={
              <ProtectedRoute>
                <InterviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results/:id"
            element={
              <ProtectedRoute>
                <ResultsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <Suspense fallback={<LazyFallback />}>
                  <HelpPage />
                </Suspense>
              </ProtectedRoute>
            }
          />

          {/* 404 Catch-All */}
          <Route
            path="*"
            element={
              <Suspense fallback={<LazyFallback />}>
                <NotFoundPage />
              </Suspense>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
