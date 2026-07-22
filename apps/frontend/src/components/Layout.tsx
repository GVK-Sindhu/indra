import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { 
  LogOut, 
  User, 
  Terminal, 
  Briefcase, 
  ShieldCheck, 
  Activity,
  Layers,
  FileText,
  BookOpen,
  Brain,
  ClipboardCheck
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'ADMIN':
        return <ShieldCheck className="h-5 w-5 text-rose-400" />;
      case 'MANAGER':
        return <Briefcase className="h-5 w-5 text-amber-400" />;
      case 'ENGINEER':
      default:
        return <Terminal className="h-5 w-5 text-emerald-400" />;
    }
  };

  const getRoleBadgeColor = () => {
    switch (user?.role) {
      case 'ADMIN':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'MANAGER':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'ENGINEER':
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-72 bg-slate-900 text-slate-100 flex flex-col justify-between p-6 z-10 shrink-0">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => navigate('/')}>
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-wider text-white">INDRA</h1>
              <p className="text-[11px] text-blue-400 font-medium tracking-wide uppercase">Industrial Knowledge AI</p>
            </div>
          </div>

          {/* User Profile Summary */}
          {user && (
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 mb-6 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-xs text-white truncate">{user.name}</h4>
                  <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 pt-2 border-t border-slate-700/60 justify-between">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${getRoleBadgeColor()} flex items-center gap-1`}>
                  {getRoleIcon()}
                  {user.role}
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-medium">
                  {user.experienceLevel}
                </span>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="flex flex-col gap-2">
            <button
              onClick={() => navigate('/')}
              className={`flex flex-col gap-0.5 px-4 py-3 rounded-xl text-left transition-all ${
                location.pathname === '/' || location.pathname === '/dashboard'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 text-xs font-semibold">
                <Activity className="h-4 w-4" />
                <span>Dashboard</span>
              </div>
              <span className="text-[10px] opacity-75 font-normal ml-7">System overview & operational status</span>
            </button>

            <button
              onClick={() => navigate('/decisions')}
              className={`flex flex-col gap-0.5 px-4 py-3 rounded-xl text-left transition-all ${
                location.pathname === '/decisions'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 text-xs font-semibold">
                <Brain className="h-4 w-4" />
                <span>Ask INDRA</span>
              </div>
              <span className="text-[10px] opacity-75 font-normal ml-7">Ask questions using voice or text</span>
            </button>

            <button
              onClick={() => navigate('/documents')}
              className={`flex flex-col gap-0.5 px-4 py-3 rounded-xl text-left transition-all ${
                location.pathname === '/documents'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 text-xs font-semibold">
                <FileText className="h-4 w-4" />
                <span>Documents</span>
              </div>
              <span className="text-[10px] opacity-75 font-normal ml-7">Upload & manage knowledge sources</span>
            </button>

            <button
              onClick={() => navigate('/knowledge')}
              className={`flex flex-col gap-0.5 px-4 py-3 rounded-xl text-left transition-all ${
                location.pathname.startsWith('/knowledge')
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 text-xs font-semibold">
                <BookOpen className="h-4 w-4" />
                <span>Integrity Alerts</span>
              </div>
              <span className="text-[10px] opacity-75 font-normal ml-7">Review conflicting or unreliable information</span>
            </button>

            <button
              onClick={() => navigate('/execution')}
              className={`flex flex-col gap-0.5 px-4 py-3 rounded-xl text-left transition-all ${
                location.pathname === '/execution'
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3 text-xs font-semibold">
                <ClipboardCheck className="h-4 w-4" />
                <span>Guided Execution</span>
              </div>
              <span className="text-[10px] opacity-75 font-normal ml-7">Perform SOP checklists & limit checks</span>
            </button>
          </nav>
        </div>

        {/* Footer actions */}
        <div className="mt-8 border-t border-slate-800 pt-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 p-6 md:p-8 z-10 overflow-y-auto max-h-screen bg-slate-50 text-slate-900">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
