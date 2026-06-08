import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  BrainCircuit, LayoutDashboard, Users, TrendingUp, Settings,
  HelpCircle, LogOut, Plus, Menu, X, MessageSquare
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/chat', label: 'Interview Assistant', icon: MessageSquare },
  { path: '/profile', label: 'Interviews', icon: Users },
  { path: '/dashboard', label: 'Analytics', icon: TrendingUp },
  { path: '/profile', label: 'Settings', icon: Settings },
];

const Sidebar = ({ activePath }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const active = activePath || location.pathname;

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const content = (
    <>
      {/* Logo */}
      <div className="px-5 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#000666] flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[#191c1e] leading-tight">AI Interviewer</h1>
            <p className="text-[10px] text-[#767683] font-medium">Professional Mode</p>
          </div>
        </div>
      </div>

      {/* New Interview */}
      <div className="px-4 mb-5">
        <button
          onClick={() => { navigate('/start-interview'); setMobileOpen(false); }}
          className="w-full flex items-center justify-center gap-2 bg-[#000666] text-white text-sm font-semibold py-2.5 rounded-full hover:bg-[#4e45d5] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Interview
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = active === item.path || (item.path === '/profile' && active === '/profile' && item.label === 'Settings');
          // Simple active matching
          const isItemActive = (item.label === 'Dashboard' && active === '/dashboard') ||
            (item.label === 'Interview Assistant' && active === '/chat') ||
            (item.label === 'Interviews' && (active === '/profile' || active.startsWith('/results'))) ||
            (item.label === 'Settings' && active === '/settings');
          return (
            <Link
              key={item.label}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`sidebar-link ${isItemActive ? 'active' : ''}`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto border-t border-[#e5e7eb] pt-3 px-4">
        <Link to="/dashboard" className="sidebar-link" onClick={() => setMobileOpen(false)}>
          <HelpCircle className="w-[18px] h-[18px]" />
          Help
        </Link>
        <button
          onClick={handleLogout}
          className="sidebar-link w-full text-left text-red-500 hover:!bg-red-50 hover:!text-red-600"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar hidden md:flex">{content}</aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#e5e7eb] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#000666] flex items-center justify-center">
            <BrainCircuit className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold text-[#191c1e]">AI Interviewer</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg hover:bg-gray-100">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)}>
          <div
            className="w-[220px] h-full bg-[#f8f9fb] border-r border-[#e5e7eb] flex flex-col py-5"
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
