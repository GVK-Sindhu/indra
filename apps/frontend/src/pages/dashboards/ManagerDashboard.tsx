import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/GlassCard.js';
import api from '../../services/api.js';
import { 
  CheckCircle2, 
  Clock, 
  XCircle,
  AlertTriangle,
  FileText,
  HelpCircle,
  RefreshCw,
  Compass,
  ArrowRight
} from 'lucide-react';

interface DashboardStats {
  averageKri: number;
  highRiskAssetsCount: number;
  pendingInspections: number;
  contradictionsCount: number;
  recurringFailures: number;
  totalMaintenanceSessions: number;
  maintenanceSuccessRate: number;
  avgDurationMinutes: number;
}

interface HeatmapAsset {
  assetId: string;
  code: string;
  name: string;
  kriScore: number;
  dciScore: number;
  severity: 'Optimal' | 'Moderate' | 'Critical';
}

interface RecentDecision {
  id: string;
  topic: string;
  assetCode: string;
  dci: number;
  status: string;
  date: string;
}

interface RecentAlert {
  id: string;
  assetCode: string;
  type: string;
  severity: string;
  description: string;
  status: string;
  createdAt: string;
}

interface DashboardData {
  stats: DashboardStats;
  heatmap: HeatmapAsset[];
  decisions: RecentDecision[];
  alerts: RecentAlert[];
  knowledgeTrend: {
    totalDocuments: number;
    totalFacts: number;
  };
}

export const ManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DashboardData>('/api/v1/analytics/dashboard');
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve management intelligence metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getHeatmapColor = (score: number) => {
    if (score >= 75) return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25';
    if (score >= 45) return 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/25';
    return 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/25';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-rose-400" />;
      case 'PENDING':
      default:
        return <Clock className="h-4 w-4 text-amber-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'REJECTED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'PENDING':
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'Critical':
        return 'bg-rose-500/15 border-rose-500/20 text-rose-400';
      case 'High':
        return 'bg-orange-500/15 border-orange-500/20 text-orange-400';
      case 'Medium':
        return 'bg-amber-500/15 border-amber-500/20 text-amber-400';
      case 'Low':
      default:
        return 'bg-blue-500/15 border-blue-500/20 text-blue-400';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="h-8 w-8 text-brand-500 animate-spin" />
        <p className="text-xs text-slate-400 font-medium">Synchronizing system telemetry...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex flex-col gap-4 max-w-md mx-auto mt-10">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="h-5 w-5" />
          <span>Dashboard Synchronization Error</span>
        </div>
        <p className="text-xs">{error || 'Data loading anomaly encountered.'}</p>
        <button
          onClick={fetchDashboardData}
          className="mt-2 bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-2 border border-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Retry Connection
        </button>
      </div>
    );
  }

  const { stats, heatmap, decisions, alerts, knowledgeTrend } = data;

  return (
    <div className="flex flex-col gap-8">
      {/* Title */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Manager Decisions Center</h2>
          <p className="text-slate-500 text-xs mt-1">
            Monitor system validation KRI health indexes, audit pipelines, and confirm decision brief logs.
          </p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95 shrink-0 shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Synchronize Stats
        </button>
      </div>

      {/* Stats Widgets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <GlassCard className="bg-white border-slate-200 flex items-center justify-between p-5" hoverEffect={false}>
          <div>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Average System KRI</p>
            <h4 className="text-3xl font-black text-slate-900 mt-1">{stats.averageKri}%</h4>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Integrity index threshold</p>
          </div>
          <div className="h-10 w-10 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
            <Compass className="h-5 w-5" />
          </div>
        </GlassCard>

        <GlassCard className="bg-white border-slate-200 flex items-center justify-between p-5" hoverEffect={false}>
          <div>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">High Risk Asset Nodes</p>
            <h4 className="text-3xl font-black text-rose-600 mt-1">{stats.highRiskAssetsCount}</h4>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Critical safety warning</p>
          </div>
          <div className="h-10 w-10 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </GlassCard>

        <GlassCard className="bg-white border-slate-200 flex items-center justify-between p-5" hoverEffect={false}>
          <div>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Missing Inspections</p>
            <h4 className="text-3xl font-black text-amber-600 mt-1">{stats.pendingInspections}</h4>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Regulatory calibration limits</p>
          </div>
          <div className="h-10 w-10 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        </GlassCard>

        <GlassCard className="bg-white border-slate-200 flex items-center justify-between p-5" hoverEffect={false}>
          <div>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Logical Contradictions</p>
            <h4 className="text-3xl font-black text-rose-600 mt-1">{stats.contradictionsCount}</h4>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold">Conflict warnings flagged</p>
          </div>
          <div className="h-10 w-10 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
            <XCircle className="h-5 w-5" />
          </div>
        </GlassCard>
      </div>

      {/* Main split grid: Heatmap & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KRI Integrity Heatmap grid (Sprint 8) */}
        <GlassCard className="bg-white border-slate-200 lg:col-span-2 flex flex-col justify-between" hoverEffect={false}>
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Knowledge Integrity Heatmap</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Visual map of operational systems. Blocks are color-coded by real-time KRI reliability scores (30% Doc freshness, 30% consistency, 20% completeness, 20% approvals). Click a node to drill down into asset details.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {heatmap.map((asset) => (
                <div 
                  key={asset.assetId}
                  onClick={() => navigate(`/assets/${asset.assetId}`)}
                  className={`p-4 rounded-2xl border cursor-pointer flex flex-col justify-between gap-4 transition-all duration-300 ${getHeatmapColor(asset.kriScore)}`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider">{asset.code}</span>
                    <ArrowRight className="h-3 w-3 shrink-0" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold leading-tight line-clamp-1">{asset.name}</h5>
                    <div className="flex items-baseline justify-between mt-3">
                      <span className="text-lg font-black">{asset.kriScore}%</span>
                      <span className="text-[8px] font-bold uppercase tracking-wide">KRI Score</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Knowledge Base Trend Widget */}
        <GlassCard className="bg-white border-slate-200 flex flex-col justify-between" hoverEffect={false}>
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-6">Knowledge Graph Stats</h3>
            
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-800">Compiled Documents</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Approved references catalog</p>
                  </div>
                </div>
                <div className="text-xl font-black text-slate-900">{knowledgeTrend.totalDocuments}</div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Compass className="h-5 w-5 text-indigo-600" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-800">Extracted Facts</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">Limits and safety clauses</p>
                  </div>
                </div>
                <div className="text-xl font-black text-slate-900">{knowledgeTrend.totalFacts}</div>
              </div>
            </div>
            
            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
              <h5 className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Maintenance Statistics</h5>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Checklist Runs</span>
                  <span className="text-sm font-bold text-slate-900">{stats.totalMaintenanceSessions}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Success Rate</span>
                  <span className="text-sm font-bold text-emerald-700">{stats.maintenanceSuccessRate}%</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[9px] text-slate-500 block uppercase font-bold">Avg Repair Duration</span>
                  <span className="text-xs font-bold text-slate-900">{stats.avgDurationMinutes} minutes</span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Decisions timeline and Active Warnings split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Decisions checklist */}
        <GlassCard className="bg-white border-slate-200 lg:col-span-2 flex flex-col justify-between" hoverEffect={false}>
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-6">Recent Decision Intelligence Pipelines</h3>
            
            {decisions.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No recent decision briefs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="pb-3 pr-4">Pipeline</th>
                      <th className="pb-3 pr-4">Decision Topic</th>
                      <th className="pb-3 pr-4 text-center">DCI</th>
                      <th className="pb-3 pr-4 text-center">Status</th>
                      <th className="pb-3 text-right">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {decisions.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate('/decisions')}>
                        <td className="py-4 font-mono font-bold text-blue-700 pr-4">{d.assetCode}</td>
                        <td className="py-4 font-semibold text-slate-900 pr-4 max-w-[220px] truncate">{d.topic}</td>
                        <td className="py-4 text-center font-black pr-4">
                          <span className={d.dci >= 75 ? 'text-emerald-700' : d.dci >= 45 ? 'text-amber-700' : 'text-rose-700'}>
                            {d.dci}%
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex justify-center">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold ${getStatusBadge(d.status)}`}>
                              {getStatusIcon(d.status)}
                              {d.status}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-right text-slate-500 font-medium">{d.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Active compliance alerts catalog summary */}
        <GlassCard className="bg-white border-slate-200 flex flex-col justify-between" hoverEffect={false}>
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-6">Active Warnings Scan</h3>
            {alerts.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                No active integrity discrepancies logged.
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                {alerts.map(a => (
                  <div key={a.id} className="p-3 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-mono font-bold text-blue-700">{a.assetCode}</span>
                      <span className={`px-1.5 py-0.5 border text-[8px] font-bold rounded-full uppercase tracking-wide ${getSeverityBadge(a.severity)}`}>
                        {a.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium line-clamp-2">{a.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-200 text-[9px] text-slate-500 flex items-start gap-2">
            <HelpCircle className="h-4 w-4 text-blue-600 shrink-0" />
            <span>Redundancy rules check limits contradictions, version anomalies, regulatory clearance alignments, and overdue calibration dates.</span>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default ManagerDashboard;
