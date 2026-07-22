import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/GlassCard.js';
import api from '../services/api.js';
import { 
  RefreshCw, 
  ArrowLeft, 
  FileText, 
  ClipboardCheck, 
  AlertOctagon
} from 'lucide-react';

interface AlertDetail {
  id: string;
  type: string;
  severity: string;
  description: string;
  status: string;
}

interface DecisionHistory {
  id: string;
  problem: string;
  dci: number;
  status: string;
  date: string;
}

interface ProcedureLink {
  id: string;
  name: string;
  stepsCount: number;
}

interface DocumentLink {
  id: string;
  title: string;
  type: string;
  status: string;
  version: number;
}

interface IncidentDetail {
  description: string;
  pageNumber: number;
  confidence: number;
  timestamp: string;
}

interface LessonDetail {
  procedureName: string;
  lesson: string;
  feedback?: string;
  date: string;
}

interface AssetDetails {
  asset: {
    id: string;
    name: string;
    code: string;
    type: string;
    description?: string;
    kriScore: number;
    dciScore: number;
  };
  alertsCount: number;
  alerts: AlertDetail[];
  decisions: DecisionHistory[];
  procedures: ProcedureLink[];
  documents: DocumentLink[];
  incidents: IncidentDetail[];
  lessonsLearned: LessonDetail[];
}

export const AssetDetailPage: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  
  const [data, setData] = useState<AssetDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssetDetails = async () => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AssetDetails>(`/api/v1/analytics/assets/${assetId}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve asset details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssetDetails();
  }, [assetId]);

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 45) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 75) return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
    if (score >= 45) return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
    return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
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
        <p className="text-xs text-slate-400 font-medium">Retrieving asset telemetry...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex flex-col gap-4 max-w-md mx-auto mt-10">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertOctagon className="h-5 w-5" />
          <span>Asset Scan Failure</span>
        </div>
        <p className="text-xs">{error || 'Data loading anomaly encountered.'}</p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 self-start border border-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { asset, alerts, decisions, procedures, documents, incidents, lessonsLearned } = data;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/')}
            className="h-10 w-10 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-all active:scale-95 shrink-0 shadow-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                Asset Node Profile
              </span>
              <span className="text-xs text-slate-500 font-mono font-semibold">{asset.code}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mt-1 leading-tight">{asset.name}</h2>
          </div>
        </div>

        <button
          onClick={fetchAssetDetails}
          className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition-all active:scale-95 shrink-0 shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload Telemetry
        </button>
      </div>

      {/* Top statistics panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* KRI Gauge */}
        <GlassCard className="bg-white border-slate-200 flex items-center gap-6" hoverEffect={false}>
          <div className="relative h-20 w-20 shrink-0 flex items-center justify-center bg-slate-50 rounded-full border border-slate-200 shadow-inner">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="40" cy="40" r="32" stroke="rgba(0,0,0,0.05)" strokeWidth="5.5" fill="transparent" />
              <circle 
                cx="40" 
                cy="40" 
                r="32" 
                stroke="#2563eb" 
                strokeWidth="5.5" 
                fill="transparent" 
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - asset.kriScore / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-base font-bold text-slate-900">{asset.kriScore}%</div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Knowledge Reliability (KRI)</h4>
            <span className={`text-[10px] font-semibold px-2 py-0.5 border rounded-md inline-block mt-2 ${getScoreBg(asset.kriScore)}`}>
              {asset.kriScore >= 75 ? 'Healthy Structure' : asset.kriScore >= 45 ? 'Verification Warning' : 'Critical Discrepancy'}
            </span>
          </div>
        </GlassCard>

        {/* DCI average gauge */}
        <GlassCard className="bg-white border-slate-200 flex items-center gap-6" hoverEffect={false}>
          <div className="relative h-20 w-20 shrink-0 flex items-center justify-center bg-slate-50 rounded-full border border-slate-200 shadow-inner">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="40" cy="40" r="32" stroke="rgba(0,0,0,0.05)" strokeWidth="5.5" fill="transparent" />
              <circle 
                cx="40" 
                cy="40" 
                r="32" 
                stroke="#3b82f6" 
                strokeWidth="5.5" 
                fill="transparent" 
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - asset.dciScore / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-base font-bold text-slate-900">{asset.dciScore}%</div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Decision Confidence (DCI)</h4>
            <span className={`text-[10px] font-semibold px-2 py-0.5 border rounded-md inline-block mt-2 ${getScoreBg(asset.dciScore)}`}>
              {asset.dciScore >= 75 ? 'Optimal Trust' : asset.dciScore >= 45 ? 'Caution' : 'Abstaining Warning'}
            </span>
          </div>
        </GlassCard>

        {/* Alerts summary */}
        <GlassCard className="bg-white border-slate-200 flex items-center gap-5" hoverEffect={false}>
          <div className="h-12 w-12 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl flex items-center justify-center shrink-0">
            <AlertOctagon className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active Compliance Alerts</h4>
            <p className="text-2xl font-bold text-rose-600 mt-1">{alerts.length}</p>
          </div>
        </GlassCard>
      </div>

      {/* Main split details view */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Active integrity alerts list */}
          <GlassCard className="bg-white border-slate-200" hoverEffect={false}>
            <h3 className="text-base font-bold text-slate-900 mb-4">Core Integrity Alerts ({alerts.length})</h3>
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs border border-slate-200 bg-slate-50 rounded-xl">
                No active integrity discrepancies logged.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {alerts.map((al) => (
                  <div key={al.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg flex items-center justify-center shrink-0">
                        <AlertOctagon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-relaxed">{al.description}</p>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mt-2">
                          Conflict Category: {al.type}
                        </span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full uppercase tracking-wider shrink-0 ${getSeverityBadge(al.severity)}`}>
                      {al.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Historical Decisions list */}
          <GlassCard className="bg-white border-slate-200" hoverEffect={false}>
            <h3 className="text-base font-bold text-slate-900 mb-4">Historical Decision Briefs</h3>
            {decisions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs border border-slate-200 bg-slate-50 rounded-xl">
                No decision briefs compiled for this asset.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                      <th className="pb-3 pr-4">Topic / Problem</th>
                      <th className="pb-3 pr-4 text-center">DCI</th>
                      <th className="pb-3 pr-4 text-center">Status</th>
                      <th className="pb-3 text-right">Compiled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {decisions.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => navigate('/decisions')}>
                        <td className="py-4 font-bold text-slate-900 pr-4">{d.problem}</td>
                        <td className="py-4 text-center pr-4">
                          <span className={`font-bold ${getScoreColor(d.dci)}`}>{d.dci}%</span>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex justify-center">
                            <span className="px-2 py-0.5 border text-[9px] font-bold rounded-full uppercase tracking-wide bg-slate-100 text-slate-700 border-slate-200">
                              {d.status}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-right text-slate-500 font-medium">
                          {new Date(d.date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          {/* Incident Reports Log */}
          <GlassCard className="bg-white border-slate-200" hoverEffect={false}>
            <h3 className="text-base font-bold text-slate-900 mb-4">Incident Log Entries</h3>
            {incidents.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs border border-slate-200 bg-slate-50 rounded-xl">
                No incidents reported in the facts base.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {incidents.map((inc, i) => (
                  <div key={i} className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex flex-col gap-2">
                    <p className="text-xs text-slate-900 leading-relaxed font-medium">{inc.description}</p>
                    <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase tracking-wider pt-2 border-t border-rose-200/60">
                      <span>Source Doc Page {inc.pageNumber}</span>
                      <span>Verified: {new Date(inc.timestamp).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Sidebar drill downs: Docs, Procedures and continuous learnings */}
        <div className="flex flex-col gap-6">
          {/* Mapped Documents */}
          <GlassCard className="bg-white border-slate-200" hoverEffect={false}>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Reference Library</h3>
            <div className="flex flex-col gap-2.5">
              {documents.map(d => (
                <div key={d.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4.5 w-4.5 text-blue-600 shrink-0" />
                    <span className="text-xs text-slate-900 font-bold truncate">{d.title}</span>
                  </div>
                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md font-mono shrink-0 font-bold uppercase">
                    v{d.version}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Mapped Procedures */}
          <GlassCard className="bg-white border-slate-200" hoverEffect={false}>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Operational SOPs</h3>
            <div className="flex flex-col gap-2.5">
              {procedures.map(p => (
                <div key={p.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 cursor-pointer hover:border-blue-300" onClick={() => navigate('/execution')}>
                  <div className="flex items-center gap-2 truncate">
                    <ClipboardCheck className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                    <span className="text-xs text-slate-900 font-bold truncate">{p.name}</span>
                  </div>
                  <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md shrink-0 font-bold">
                    {p.stepsCount} Steps
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Continuous learnings logs */}
          <GlassCard className="bg-white border-slate-200" hoverEffect={false}>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Continuous Learning Logs</h3>
            {lessonsLearned.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-[10px] italic border border-slate-200 bg-slate-50 rounded-xl">
                No lessons learned archived yet. Complete procedure execution sessions to capture.
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {lessonsLearned.map((l, i) => (
                  <div key={i} className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-col gap-1.5">
                    <h5 className="text-[10px] text-blue-800 font-bold uppercase tracking-wide truncate">
                      {l.procedureName}
                    </h5>
                    <p className="text-xs text-slate-800 leading-relaxed italic">
                      "{l.lesson}"
                    </p>
                    {l.feedback && (
                      <p className="text-[10px] text-slate-500 leading-relaxed mt-1">
                        Feedback: {l.feedback}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AssetDetailPage;
