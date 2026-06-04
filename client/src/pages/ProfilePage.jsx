import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { interviewAPI } from '../services/api';
import Sidebar from '../components/Sidebar';
import { SkeletonCard } from '../components/LoadingSpinner';
import { Mail, Clock, ChevronRight, ChevronLeft, Filter, TrendingUp, MessageSquare, Users } from 'lucide-react';

const ITEMS_PER_PAGE = 6;

const ProfilePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchInterviews = async () => {
      try {
        const res = await interviewAPI.getAll();
        setInterviews(res.data.data || []);
      } catch (err) {
        console.error('Failed to fetch interviews:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInterviews();
  }, []);

  // ── Computed stats ──
  const completedInterviews = interviews.filter(
    (i) => i.status === 'completed' || i.status === 'evaluated'
  );
  const totalCount = interviews.length;
  const avgScore =
    completedInterviews.length > 0
      ? Math.round(
          completedInterviews.reduce((sum, i) => sum + (i.overallScore || 0), 0) /
            completedInterviews.length
        )
      : 0;

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(interviews.length / ITEMS_PER_PAGE));
  const paginatedInterviews = interviews.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const showingFrom = interviews.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const showingTo = Math.min(currentPage * ITEMS_PER_PAGE, interviews.length);

  // ── Helpers ──
  const getInitials = () => {
    const name = user?.username || user?.name || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-500';
  };

  const getStatusPill = (status) => {
    const map = {
      completed: {
        label: 'Completed',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      evaluated: {
        label: 'Evaluated',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      'in-progress': {
        label: 'In Progress',
        cls: 'bg-amber-50 text-amber-700 border-amber-200',
      },
      pending: {
        label: 'Pending',
        cls: 'bg-gray-50 text-gray-600 border-gray-200',
      },
    };
    const s = map[status] || map.pending;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}
      >
        {s.label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="page-enter min-h-screen bg-[#f7f9fb]">
      <Sidebar activePath="/profile" />

      <main className="md:ml-[220px] min-h-screen p-6 md:p-8">
        {/* ── Header ── */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#191c1e]">User Profile</h2>
          <p className="text-sm text-[#767683] mt-1">
            Manage your account details and review your performance history.
          </p>
        </div>

        {loading ? (
          <div className="space-y-5">
            <SkeletonCard />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <SkeletonCard />
          </div>
        ) : (
          <>
            {/* ── User Info + Stats Row ── */}
            <div className="flex flex-col lg:flex-row gap-5 mb-8">
              {/* Left: User Info Card */}
              <div className="card p-6 flex-1">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  {/* Avatar */}
                  <div className="w-20 h-20 rounded-full bg-[#000666] flex items-center justify-center shrink-0">
                    <span className="text-2xl font-bold text-white">{getInitials()}</span>
                  </div>

                  <div className="text-center sm:text-left flex-1">
                    <h3 className="text-xl font-bold text-[#191c1e]">
                      {user?.username || user?.name || 'User'}
                    </h3>

                    <div className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-[#767683] mt-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{user?.email || 'email@example.com'}</span>
                    </div>

                    {/* Badge pills */}
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#eef2ff] text-[#000666] border border-[#c6c5d4]">
                        {user?.role || 'Candidate'}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#f7f9fb] text-[#767683] border border-[#c6c5d4]">
                        {user?.location || 'Remote'}
                      </span>
                    </div>

                    {/* Edit Profile button */}
                    <button className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#c6c5d4] text-sm font-medium text-[#191c1e] hover:bg-[#f7f9fb] transition-colors">
                      Edit Profile
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Stats Cards */}
              <div className="flex flex-col gap-5 lg:w-[280px]">
                {/* Total Interviews */}
                <div className="card p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-[#767683] uppercase tracking-wider">
                      Total Interviews
                    </p>
                    <p className="text-2xl font-bold text-[#191c1e]">{totalCount}</p>
                  </div>
                </div>

                {/* Average Score */}
                <div className="card p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-[#767683] uppercase tracking-wider">
                      Average Score
                    </p>
                    <p className="text-2xl font-bold text-[#191c1e]">
                      {avgScore}
                      <span className="text-sm font-normal text-[#767683]"> /100</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Interview History Section ── */}
            <div>
              {/* Section heading */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#767683]" />
                  <h3 className="text-lg font-semibold text-[#191c1e]">Interview History</h3>
                </div>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#c6c5d4] text-sm font-medium text-[#767683] hover:bg-white hover:text-[#191c1e] transition-colors">
                  <Filter className="w-3.5 h-3.5" />
                  Filter
                </button>
              </div>

              {/* Table Card */}
              <div className="card overflow-hidden">
                {interviews.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#f7f9fb] flex items-center justify-center mx-auto mb-4">
                      <Clock className="w-7 h-7 text-[#c6c5d4]" />
                    </div>
                    <h4 className="text-base font-semibold text-[#191c1e] mb-1">
                      No interviews yet
                    </h4>
                    <p className="text-sm text-[#767683] mb-4">
                      Start your first interview to see your history here.
                    </p>
                    <button
                      onClick={() => navigate('/start-interview')}
                      className="btn-primary rounded-full text-sm"
                    >
                      Start Interview
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-[#e5e7eb]">
                            <th className="text-left px-6 py-3 text-xs font-semibold text-[#767683] uppercase tracking-wider">
                              Date
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-[#767683] uppercase tracking-wider">
                              Role
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-[#767683] uppercase tracking-wider">
                              Score
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-[#767683] uppercase tracking-wider">
                              Status
                            </th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-[#767683] uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedInterviews.map((interview) => {
                            const id = interview._id || interview.id;
                            const score = interview.overallScore;
                            const isFinished =
                              interview.status === 'completed' || interview.status === 'evaluated';
                            const isInProgress = interview.status === 'in-progress';

                            return (
                              <tr
                                key={id}
                                className="border-b border-[#e5e7eb] last:border-b-0 hover:bg-[#f7f9fb] transition-colors cursor-pointer"
                                onClick={() => isFinished && navigate(`/results/${id}`)}
                              >
                                <td className="px-6 py-4 text-sm text-[#454652]">
                                  {formatDate(interview.createdAt)}
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-[#191c1e]">
                                  {interview.role || 'General'}
                                </td>
                                <td className="px-6 py-4">
                                  {score != null ? (
                                    <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                                      {score}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-[#c6c5d4]">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">{getStatusPill(interview.status)}</td>
                                <td className="px-6 py-4">
                                  {isFinished ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/results/${id}`);
                                      }}
                                      className="text-sm font-medium text-[#000666] hover:text-[#4e45d5] transition-colors"
                                    >
                                      View Report →
                                    </button>
                                  ) : isInProgress ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/interview/${id}`);
                                      }}
                                      className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
                                    >
                                      Resume ▸
                                    </button>
                                  ) : (
                                    <span className="text-sm text-[#c6c5d4]">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-[#e5e7eb]">
                      {paginatedInterviews.map((interview) => {
                        const id = interview._id || interview.id;
                        const score = interview.overallScore;
                        const isFinished =
                          interview.status === 'completed' || interview.status === 'evaluated';
                        const isInProgress = interview.status === 'in-progress';

                        return (
                          <div
                            key={id}
                            className="p-4 hover:bg-[#f7f9fb] transition-colors cursor-pointer"
                            onClick={() => isFinished && navigate(`/results/${id}`)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-[#191c1e]">
                                {interview.role || 'General'}
                              </span>
                              {getStatusPill(interview.status)}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-[#767683]">
                                {formatDate(interview.createdAt)}
                              </span>
                              <div className="flex items-center gap-3">
                                {score != null ? (
                                  <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                                    {score}
                                  </span>
                                ) : (
                                  <span className="text-sm text-[#c6c5d4]">-</span>
                                )}
                                {isFinished && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/results/${id}`);
                                    }}
                                    className="text-xs font-medium text-[#000666]"
                                  >
                                    View →
                                  </button>
                                )}
                                {isInProgress && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/interview/${id}`);
                                    }}
                                    className="text-xs font-medium text-amber-600"
                                  >
                                    Resume ▸
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination */}
                    {interviews.length > ITEMS_PER_PAGE && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-[#e5e7eb]">
                        <p className="text-sm text-[#767683]">
                          Showing {showingFrom} to {showingTo} of {interviews.length} entries
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-lg border border-[#e5e7eb] text-[#767683] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                page === currentPage
                                  ? 'bg-[#000666] text-white'
                                  : 'text-[#767683] hover:bg-white border border-[#e5e7eb]'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-lg border border-[#e5e7eb] text-[#767683] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ProfilePage;
