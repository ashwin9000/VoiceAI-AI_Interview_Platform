import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { interviewAPI } from '../services/api';
import { ROLES, LANGUAGES } from '../utils/constants';
import Sidebar from '../components/Sidebar';
import {
  Monitor, Server, Layers, Atom, Hexagon, Coffee, Terminal, BarChart3,
  BrainCircuit, Cpu, GitBranch, Code2, FileCode, FileType, Braces, Hash,
  Workflow, Briefcase, Play, ChevronRight, Code, CheckCircle2, TrendingUp
} from 'lucide-react';

const iconMap = { Monitor, Server, Layers, Atom, Hexagon, Coffee, Terminal, BarChart3, BrainCircuit, Cpu, GitBranch, Code2, FileCode, FileType, Braces, Hash, Workflow };

const getBadge = (roleId) => {
  const map = {
    'frontend-developer': { label: 'ENGINEERING', cls: 'badge-engineering' },
    'backend-developer': { label: 'ENGINEERING', cls: 'badge-engineering' },
    'fullstack-developer': { label: 'POPULAR', cls: 'badge-popular' },
    'react-developer': { label: 'SPECIALIZED', cls: 'badge-specialized' },
    'nodejs-developer': { label: 'SPECIALIZED', cls: 'badge-specialized' },
    'java-developer': { label: 'ENTERPRISE', cls: 'badge-enterprise' },
  };
  return map[roleId] || { label: 'ENGINEERING', cls: 'badge-engineering' };
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInterviews = async () => {
      try {
        const res = await interviewAPI.getAll();
        setInterviews(res.data.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchInterviews();
  }, []);

  const evaluated = interviews.filter(i => i.status === 'evaluated');
  const completedCount = evaluated.length;
  const avgScore = completedCount > 0
    ? Math.round(evaluated.reduce((s, i) => s + (i.score || 0), 0) / completedCount)
    : 0;

  const displayRoles = ROLES.slice(0, 6);

  return (
    <>
      <Sidebar activePath="/dashboard" />
      <div className="page-enter min-h-screen bg-[#f7f9fb]">

      <main className="md:ml-[220px] min-h-screen p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-[#191c1e] font-display mb-2">Select Assessment</h2>
            <p className="text-[#454652] text-sm max-w-xl leading-relaxed">
              Choose a specialized role or specific programming language to begin your AI-driven technical evaluation. The system will adapt to your selected domain.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="card px-5 py-4 min-w-[130px] flex items-center gap-3">
              <div>
                <p className="text-[10px] text-[#767683] font-medium uppercase tracking-wide">Completed</p>
                <p className="text-2xl font-bold text-[#191c1e]">{loading ? '—' : completedCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center ml-auto">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <div className="card px-5 py-4 min-w-[130px] flex items-center gap-3">
              <div>
                <p className="text-[10px] text-[#767683] font-medium uppercase tracking-wide">Avg Score</p>
                <p className="text-2xl font-bold text-[#191c1e]">{loading ? '—' : `${avgScore}%`}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center ml-auto">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Roles */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="icon-box"><Briefcase className="w-5 h-5" /></div>
              <h3 className="text-lg font-semibold text-[#191c1e]">Roles</h3>
            </div>
            <Link to="/profile" className="text-sm font-medium text-[#4e45d5] hover:text-[#000666] flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayRoles.map((role) => {
              const IconComp = iconMap[role.icon] || Code2;
              const badge = getBadge(role.id);
              return (
                <div key={role.id} className="card p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="icon-box"><IconComp className="w-5 h-5" /></div>
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[#191c1e] mb-1">{role.name}</h4>
                    <p className="text-xs text-[#454652] leading-relaxed">{role.description}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/start-interview?role=${role.id}`)}
                    className="btn-outline mt-auto self-start text-xs"
                  >
                    Start Interview <Play className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Languages */}
        <section className="mb-10">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="icon-box"><Code className="w-5 h-5" /></div>
            <h3 className="text-lg font-semibold text-[#191c1e]">Languages</h3>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {LANGUAGES.map((lang) => {
              const IconComp = iconMap[lang.icon] || Code2;
              return (
                <div
                  key={lang.id}
                  className="card p-4 flex items-center gap-3 min-w-[200px] shrink-0 cursor-pointer group"
                  onClick={() => navigate(`/start-interview?role=${lang.name} Developer`)}
                >
                  <div className="icon-box"><IconComp className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#191c1e]">{lang.name}</p>
                    <p className="text-[11px] text-[#767683]">Core Language</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#c6c5d4] group-hover:text-[#4e45d5] transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        </section>
      </main>
      </div>
    </>
  );
};

export default DashboardPage;
