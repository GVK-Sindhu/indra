import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/GlassCard.js';
import { 
  Activity, 
  Info, 
  Upload, 
  Brain, 
  ClipboardCheck,
  ShieldCheck,
  FileText,
  Sliders
} from 'lucide-react';

export const EngineerDashboard: React.FC = () => {
  const navigate = useNavigate();

  // KRI state (0 to 1)
  const [kriFreshness, setKriFreshness] = useState(0.8);
  const [kriConsistency, setKriConsistency] = useState(0.7);
  const [kriCompleteness, setKriCompleteness] = useState(0.9);
  const [kriHumanApproval, setKriHumanApproval] = useState(0.8);

  // DCI state (0 to 1)
  const [dciEvidence, setDciEvidence] = useState(0.75);
  const [dciDocFreshness, setDciDocFreshness] = useState(0.8);
  const [dciHistSuccess, setDciHistSuccess] = useState(0.65);
  const [dciDataCompleteness, setDciDataCompleteness] = useState(0.85);
  const [dciHumanVal, setDciHumanVal] = useState(0.9);

  // KRI Calculation: 30% Freshness + 30% Consistency + 20% Completeness + 20% Human Approval
  const calculateKRI = () => {
    const score = (0.3 * kriFreshness) + 
                  (0.3 * kriConsistency) + 
                  (0.2 * kriCompleteness) + 
                  (0.2 * kriHumanApproval);
    return Math.round(score * 100);
  };

  // DCI Calculation: 40% Evidence Agreement + 20% Doc Freshness + 20% Hist Success + 10% Data Completeness + 10% Human Validation
  const calculateDCI = () => {
    const score = (0.4 * dciEvidence) +
                  (0.2 * dciDocFreshness) +
                  (0.2 * dciHistSuccess) +
                  (0.1 * dciDataCompleteness) +
                  (0.1 * dciHumanVal);
    return Math.round(score * 100);
  };

  const getScoreBadge = (score: number) => {
    if (score >= 75) return { label: 'High Reliability', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (score >= 45) return { label: 'Moderate Reliability', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Low Confidence (Requires Review)', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const kriScore = calculateKRI();
  const dciScore = calculateDCI();

  return (
    <div className="flex flex-col gap-6">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Industrial Operations Dashboard</h2>
        <p className="text-slate-500 text-xs mt-1">
          Monitor technical knowledge reliability, run equipment queries, or execute SOP safety checklists.
        </p>
      </div>

      {/* Main double split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quick actions panel */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <GlassCard hoverEffect={false} className="bg-white border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">Quick Actions</h3>
            
            <div className="flex flex-col gap-3">
              {/* Ask INDRA */}
              <div 
                onClick={() => navigate('/decisions')}
                className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 hover:bg-blue-100/60 cursor-pointer transition-all flex items-center gap-3.5 group"
              >
                <div className="h-9 w-9 bg-blue-600 text-white rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                  <Brain className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-700">Ask INDRA</h4>
                  <p className="text-[11px] text-slate-500 truncate">Ask questions with voice or text</p>
                </div>
              </div>

              {/* Process Document */}
              <div 
                onClick={() => navigate('/documents')}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer transition-all flex items-center gap-3.5 group"
              >
                <div className="h-9 w-9 bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center shrink-0">
                  <Upload className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-700">Upload Manual / Document</h4>
                  <p className="text-[11px] text-slate-500 truncate">Ingest technical PDFs & SOPs</p>
                </div>
              </div>

              {/* Execution */}
              <div 
                onClick={() => navigate('/execution')}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer transition-all flex items-center gap-3.5 group"
              >
                <div className="h-9 w-9 bg-slate-200 text-slate-700 rounded-lg flex items-center justify-center shrink-0">
                  <ClipboardCheck className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs text-slate-900 group-hover:text-blue-700">Guided Field Execution</h4>
                  <p className="text-[11px] text-slate-500 truncate">Interactive checklist & limit checker</p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Quick info panel */}
          <GlassCard className="bg-white border-slate-200 flex items-start gap-3.5" hoverEffect={false}>
            <div className="h-9 w-9 shrink-0 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center text-blue-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-xs">Safety Guardrail Active</h4>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                If decision confidence falls below 50%, recommendations are automatically paused to prevent incorrect maintenance procedures.
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Sandboxes */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* KRI Sandbox Card */}
          <GlassCard className="bg-white border-slate-200 relative overflow-hidden flex flex-col justify-between" hoverEffect={false}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  Trust Score Simulator
                </span>
                <Sliders className="h-4 w-4 text-slate-400" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Knowledge Reliability (KRI)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  How trustworthy and consistent the available technical knowledge is.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 my-6">
                <div className="text-center p-4 rounded-xl bg-slate-50 border border-slate-200 min-w-[120px]">
                  <span className="text-3xl font-extrabold text-slate-900">{kriScore}%</span>
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase mt-0.5">KRI Score</span>
                </div>

                <div>
                  <span className={`text-xs px-2.5 py-1 rounded-md border font-semibold inline-block ${getScoreBadge(kriScore).color}`}>
                    {getScoreBadge(kriScore).label}
                  </span>
                  <p className="text-slate-600 text-xs mt-2 leading-relaxed">
                    Weighted formula: 30% document freshness, 30% logical consistency, 20% scope completeness, 20% human validation.
                  </p>
                </div>
              </div>

              {/* KRI Sliders */}
              <div className="flex flex-col gap-3.5 border-t border-slate-200 pt-4">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Document Freshness</span>
                    <span>{Math.round(kriFreshness * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={kriFreshness} onChange={(e) => setKriFreshness(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer h-1.5"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Logical Consistency</span>
                    <span>{Math.round(kriConsistency * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={kriConsistency} onChange={(e) => setKriConsistency(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer h-1.5"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Scope Completeness</span>
                    <span>{Math.round(kriCompleteness * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={kriCompleteness} onChange={(e) => setKriCompleteness(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer h-1.5"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Human Approval Weight</span>
                    <span>{Math.round(kriHumanApproval * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={kriHumanApproval} onChange={(e) => setKriHumanApproval(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer h-1.5"
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* DCI Sandbox Card */}
          <GlassCard className="bg-white border-slate-200 relative overflow-hidden flex flex-col justify-between" hoverEffect={false}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  Trust Score Simulator
                </span>
                <Sliders className="h-4 w-4 text-slate-400" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Decision Confidence (DCI)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  How confident INDRA is in its recommendation based on available evidence.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 my-6">
                <div className="text-center p-4 rounded-xl bg-slate-50 border border-slate-200 min-w-[120px]">
                  <span className="text-3xl font-extrabold text-slate-900">{dciScore}%</span>
                  <span className="text-[10px] text-slate-500 font-semibold block uppercase mt-0.5">DCI Score</span>
                </div>

                <div>
                  <span className={`text-xs px-2.5 py-1 rounded-md border font-semibold inline-block ${getScoreBadge(dciScore).color}`}>
                    {getScoreBadge(dciScore).label}
                  </span>
                  <p className="text-slate-600 text-xs mt-2 leading-relaxed">
                    Weighted formula: 40% evidence agreement, 20% document freshness, 20% historical success, 10% data completeness, 10% validation.
                  </p>
                </div>
              </div>

              {/* DCI Sliders */}
              <div className="flex flex-col gap-3.5 border-t border-slate-200 pt-4">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Evidence Agreement</span>
                    <span>{Math.round(dciEvidence * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={dciEvidence} onChange={(e) => setDciEvidence(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer h-1.5"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Documentation Freshness</span>
                    <span>{Math.round(dciDocFreshness * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={dciDocFreshness} onChange={(e) => setDciDocFreshness(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer h-1.5"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Historical Success Rate</span>
                    <span>{Math.round(dciHistSuccess * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={dciHistSuccess} onChange={(e) => setDciHistSuccess(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer h-1.5"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Data Input Completeness</span>
                    <span>{Math.round(dciDataCompleteness * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05"
                    value={dciDataCompleteness} onChange={(e) => setDciDataCompleteness(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer h-1.5"
                  />
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

      </div>
    </div>
  );
};

export default EngineerDashboard;

