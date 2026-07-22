import React, { useState, useEffect } from 'react';
import { GlassCard } from '../../components/GlassCard.js';
import api from '../../services/api.js';
import { 
  Users, 
  Database, 
  ShieldAlert, 
  CheckCircle, 
  RefreshCw,
  Cpu
} from 'lucide-react';


interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  experienceLevel: string;
  feedbackWeight: number;
  createdAt: string;
}

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ users: UserRecord[] }>('/api/v1/users');
      setUsers(res.users);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve system user catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
      case 'MANAGER':
        return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      case 'ENGINEER':
      default:
        return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">System Admin Control Center</h2>
          <p className="text-slate-500 text-xs mt-1">
            Oversee general database models, examine active user nodes, and verify environmental security settings.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all disabled:opacity-50 active:scale-95 shrink-0 shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Reload Data
        </button>
      </div>

      {/* System Telemetry */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard className="bg-white border-slate-200 flex items-center gap-4" hoverEffect={false}>
          <div className="h-12 w-12 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-center text-blue-600">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Total User Records</p>
            <h4 className="text-2xl font-black text-slate-900 mt-0.5">{users.length}</h4>
          </div>
        </GlassCard>

        <GlassCard className="bg-white border-slate-200 flex items-center gap-4" hoverEffect={false}>
          <div className="h-12 w-12 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Mongoose Database</p>
            <h4 className="text-sm font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4" /> Connected & Active
            </h4>
          </div>
        </GlassCard>

        <GlassCard className="bg-white border-slate-200 flex items-center gap-4" hoverEffect={false}>
          <div className="h-12 w-12 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-center text-blue-600">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Local Deployments</p>
            <h4 className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
              Local Host Sandbox Active
            </h4>
          </div>
        </GlassCard>
      </div>

      {/* User Management Catalog */}
      <GlassCard className="bg-white border-slate-200 w-full flex flex-col justify-between" hoverEffect={false}>
        <div>
          <h3 className="text-base font-bold text-slate-900 mb-6">User Database Catalog</h3>
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm mb-6">
              <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              <p className="text-xs text-slate-500">Fetching database schema contents...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No registered user documents found in MongoDB.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="pb-3 pr-4">User Details</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">System Role</th>
                    <th className="pb-3 pr-4 text-center">Experience Level</th>
                    <th className="pb-3 pr-4 text-center">Weight</th>
                    <th className="pb-3 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 font-bold text-slate-900 pr-4">{u.name}</td>
                      <td className="py-4 font-medium text-slate-600 pr-4">{u.email}</td>
                      <td className="py-4 pr-4">
                        <span className={`px-2 py-0.5 border text-[10px] font-bold rounded-full uppercase tracking-wide ${getRoleColor(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4 text-center text-slate-600 font-semibold pr-4">{u.experienceLevel}</td>
                      <td className="py-4 text-center font-black pr-4 text-blue-700">w = {u.feedbackWeight}</td>
                      <td className="py-4 text-right text-slate-500 font-medium">
                        {new Date(u.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default AdminDashboard;
