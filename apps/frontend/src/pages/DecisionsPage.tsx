import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../components/GlassCard.js';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { 
  Brain, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  HelpCircle,
  Link,
  ShieldCheck,
  Mic,
  MicOff,
  Square,
  Sparkles,
  FileText
} from 'lucide-react';

interface AssetRecord {
  id: string;
  name: string;
  code: string;
}

interface DecisionBrief {
  problemSummary: string;
  possibleCauses: string[];
  procedureOptions: string[];
  supportingEvidence: Array<string | RetrievedCitation>;
  conflictingEvidence: string[];
  missingInformation: string[];
  decisionConfidenceIndex: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedRepairTime: string;
  engineerApprovalRequired: boolean;
}

interface RetrievedCitation {
  chunkId: string;
  documentId?: string;
  documentName?: string;
  pageNumber?: number;
  text: string;
  boundingBox?: string;
  distance?: number;
}

interface DecisionRecord {
  id: string;
  assetId: string;
  problem: string;
  brief: DecisionBrief;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

// Declare Web Speech API interface for TypeScript
const SpeechRecognition = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

export const DecisionsPage: React.FC = () => {
  const { user } = useAuth();
  
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [loadingDecisions, setLoadingDecisions] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Input state
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  
  // Voice-to-Text state
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Active Brief Generation state
  const [generating, setGenerating] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [activeDecision, setActiveDecision] = useState<DecisionRecord | null>(null);
  const [abstainedMessage, setAbstainedMessage] = useState<string | null>(null);

  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await api.get<{ assets: AssetRecord[] }>('/api/v1/integrity/assets');
      setAssets(res.assets || []);
      if (res.assets && res.assets.length > 0) {
        setSelectedAssetId(res.assets[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load assets list.');
    } finally {
      setLoadingAssets(false);
    }
  };

  const loadDecisions = async () => {
    setLoadingDecisions(true);
    try {
      const res = await api.get<{ decisions: DecisionRecord[] }>('/api/v1/decisions');
      setDecisions(res.decisions || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDecisions(false);
    }
  };

  useEffect(() => {
    loadAssets();
    loadDecisions();

    // Clean up speech recognition on unmount
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Toggle Voice Recognition
  const toggleSpeechRecognition = () => {
    if (!SpeechRecognition) {
      setSpeechError('Voice input is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    // Start listening
    setSpeechError(null);
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript + ' ';
        }
        setProblemDescription(currentTranscript.trim());
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access was denied. Please check your browser settings.');
        } else if (event.error === 'no-speech') {
          setSpeechError('No speech was detected. Please try speaking into your microphone again.');
        } else {
          setSpeechError(`Speech recognition error (${event.error}). You can type your query manually.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
      setSpeechError('Failed to initialize speech recognition.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !problemDescription.trim()) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      setIsListening(false);
    }

    setGenerating(true);
    setBriefError(null);
    setActiveDecision(null);
    setAbstainedMessage(null);

    try {
      const res = await api.post<{ abstain: boolean; message?: string; decision?: DecisionRecord }>(
        '/api/v1/decisions/brief',
        { assetId: selectedAssetId, problem: problemDescription }
      );

      if (res.abstain) {
        setAbstainedMessage(res.message || 'INDRA cannot safely recommend an action because the available evidence is insufficient or conflicting.');
      } else if (res.decision) {
        setActiveDecision(res.decision);
        setProblemDescription('');
        loadDecisions();
      }
    } catch (err: any) {
      setBriefError(err.message || 'Failed to process request.');
    } finally {
      setGenerating(false);
    }
  };

  const handleApproval = async (id: string, approve: boolean) => {
    try {
      const endpoint = `/api/v1/decisions/${id}/${approve ? 'approve' : 'reject'}`;
      const res = await api.post<{ decision: DecisionRecord }>(endpoint, {});
      
      if (activeDecision?.id === id) {
        setActiveDecision(res.decision);
      }
      setDecisions(prev => prev.map(d => d.id === id ? res.decision : d));
    } catch (err: any) {
      alert(`Approval operation failed: ${err.message}`);
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'Critical':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'High':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const getDciBadge = (score: number) => {
    if (score >= 75) return { label: 'High Confidence', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (score >= 45) return { label: 'Moderate Confidence', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'Low Confidence', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-rose-600" />;
      case 'PENDING':
      default:
        return <Clock className="h-4 w-4 text-amber-600" />;
    }
  };

  const getAssetCode = (aId: string) => {
    return assets.find(a => a.id === aId)?.code || 'ASSET';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Ask INDRA — AI Industrial Assistant</h2>
        <p className="text-slate-500 text-xs mt-1">
          Ask questions or describe equipment issues using voice or text. Answers are grounded in your verified technical manuals and SOPs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Diagnostic / Question Input Panel */}
        <div className="flex flex-col gap-6">
          <GlassCard hoverEffect={false} className="bg-white border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>Ask a Question</span>
              {SpeechRecognition ? (
                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Mic className="h-3 w-3" /> Voice Enabled
                </span>
              ) : null}
            </h3>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {briefError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{briefError}</span>
              </div>
            )}

            {speechError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{speechError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">Target Equipment / Asset</label>
                {loadingAssets ? (
                  <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                ) : (
                  <select
                    value={selectedAssetId}
                    onChange={(e) => setSelectedAssetId(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg p-3 outline-none cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                  >
                    {assets.map(a => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-slate-700">Question or Symptoms</label>
                  {isListening && (
                    <span className="text-[10px] text-rose-600 font-bold animate-pulse flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                      Listening to voice...
                    </span>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={4}
                    required
                    placeholder="e.g. Bearing casing vibration exceeding limit with squealing noise. What maintenance steps should I follow?"
                    value={problemDescription}
                    onChange={(e) => setProblemDescription(e.target.value)}
                    className="w-full bg-white border border-slate-300 text-slate-900 text-xs rounded-lg p-3 pr-10 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none leading-relaxed"
                  />

                  {/* Microphone Action Button */}
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    title={isListening ? "Stop voice listening" : "Click to speak query"}
                    className={`absolute right-2.5 bottom-3.5 p-2 rounded-lg transition-all ${
                      isListening
                        ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-md animate-pulse'
                        : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 border border-slate-200'
                    }`}
                  >
                    {isListening ? (
                      <Square className="h-4 w-4 fill-current" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Sample Prompt Shortcuts */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Quick Example Queries:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setProblemDescription("Bearing casing vibration readings elevated to 5.2 mm/s with grinding noise.")}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 transition-colors text-left"
                  >
                    High casing vibration
                  </button>
                  <button
                    type="button"
                    onClick={() => setProblemDescription("What is the maximum allowed operating temperature for main bearings?")}
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 transition-colors text-left"
                  >
                    Max bearing temperature
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={generating || !selectedAssetId || !problemDescription.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Analyzing Technical Knowledge Base...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Ask INDRA Recommendation
                  </>
                )}
              </button>
            </form>
          </GlassCard>

          {/* Previous Queries Timeline */}
          <GlassCard hoverEffect={false} className="bg-white border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">Query History</h3>
            {loadingDecisions ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
                <span className="text-xs text-slate-500">Loading history...</span>
              </div>
            ) : decisions.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No previous questions asked yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                {decisions.map(d => (
                  <div
                    key={d.id}
                    onClick={() => { setActiveDecision(d); setAbstainedMessage(null); }}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      activeDecision?.id === d.id 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                        {getAssetCode(d.assetId)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(d.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h5 className="text-xs text-slate-800 font-semibold truncate mt-1.5">{d.problem}</h5>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] text-slate-500 font-medium">Confidence: {d.brief.decisionConfidenceIndex}%</span>
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                        {getStatusIcon(d.status)}
                        <span>{d.status}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Structured Output / Answer Area */}
        <div className="lg:col-span-2">
          {abstainedMessage ? (
            <GlassCard className="border-amber-200 bg-amber-50/60 p-6 flex flex-col items-center justify-center text-center gap-4 min-h-[380px]" hoverEffect={false}>
              <div className="h-14 w-14 bg-amber-100 border border-amber-300 rounded-xl flex items-center justify-center text-amber-700">
                <AlertCircle className="h-7 w-7" />
              </div>
              <div className="max-w-md">
                <h4 className="text-base font-bold text-slate-900">Safety Guardrail Activated</h4>
                <p className="text-xs font-semibold text-amber-800 mt-1">
                  INDRA cannot safely recommend an action because the available evidence is insufficient or conflicting.
                </p>
                <p className="text-xs text-slate-600 mt-3 leading-relaxed bg-white p-3 rounded-lg border border-amber-200">
                  {abstainedMessage}
                </p>
                
                <div className="mt-5 text-left bg-white p-4 rounded-lg border border-amber-200 text-xs">
                  <h5 className="font-bold text-slate-900 mb-2">Recommended Next Steps:</h5>
                  <ul className="list-disc list-inside flex flex-col gap-1.5 text-slate-700">
                    <li>Upload updated technical documentation in the <strong>Documents</strong> tab.</li>
                    <li>Review conflicting values in the <strong>Knowledge Base</strong>.</li>
                    <li>Perform a manual field inspection before taking maintenance action.</li>
                  </ul>
                </div>
              </div>
            </GlassCard>
          ) : activeDecision ? (
            <GlassCard className="bg-white border-slate-200 flex flex-col gap-6" hoverEffect={false}>
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wide">
                      AI Recommendation
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getRiskBadge(activeDecision.brief.riskLevel)}`}>
                      {activeDecision.brief.riskLevel} Risk
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mt-2">{activeDecision.problem}</h4>
                </div>

                {/* Confidence Card */}
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl shrink-0">
                  <div className="text-center">
                    <span className="text-xl font-bold text-slate-900">{activeDecision.brief.decisionConfidenceIndex}%</span>
                    <span className="text-[9px] text-slate-500 font-semibold uppercase block">Score</span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-[10px] text-slate-500 font-medium block">Decision Confidence</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border inline-block mt-0.5 ${getDciBadge(activeDecision.brief.decisionConfidenceIndex).color}`}>
                      {getDciBadge(activeDecision.brief.decisionConfidenceIndex).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Problem summary / Answer */}
              <div>
                <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Recommended Action Plan
                </h5>
                <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 font-normal">
                  {activeDecision.brief.problemSummary}
                </p>
              </div>

              {/* Causes and procedure options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-xs font-bold text-slate-700 mb-2">Possible Root Causes</h5>
                  <ul className="flex flex-col gap-2">
                    {activeDecision.brief.possibleCauses.map((c, i) => (
                      <li key={i} className="text-xs text-slate-700 flex items-start gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h5 className="text-xs font-bold text-slate-700 mb-2">Recommended Procedures</h5>
                  <ul className="flex flex-col gap-2">
                    {activeDecision.brief.procedureOptions.map((o, i) => (
                      <li key={i} className="text-xs text-slate-700 flex items-start gap-2 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                        <span>{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Supporting Evidence */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-4">
                <div>
                  <h5 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Supporting Evidence & Sources
                  </h5>
                  <div className="flex flex-col gap-2">
                    {activeDecision.brief.supportingEvidence.map((e, i) => (
                      <div key={i} className="text-xs text-slate-700 bg-white border border-slate-200 p-3 rounded-lg flex items-start gap-2">
                        <FileText className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        {typeof e === 'string' ? (
                          <span>{e}</span>
                        ) : (
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="font-medium text-slate-800">{e.text}</span>
                            <span className="text-[11px] text-slate-500">
                              Source: {e.documentName || 'Technical Manual'} · Page {e.pageNumber ?? 'N/A'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Conflicting evidence if any */}
                {activeDecision.brief.conflictingEvidence.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      Conflicting Information Detected
                    </h5>
                    <div className="flex flex-col gap-2">
                      {activeDecision.brief.conflictingEvidence.map((e, i) => (
                        <div key={i} className="text-xs text-slate-700 bg-orange-50 border border-orange-200 p-2.5 rounded-lg">
                          <span>{e}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Approval status banner */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-4 bg-slate-50 p-4 -mx-6 -mb-6 rounded-b-xl">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-600">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase block">Approval Status</span>
                    <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1 mt-0.5">
                      {getStatusIcon(activeDecision.status)}
                      {activeDecision.status}
                    </span>
                  </div>
                </div>

                {activeDecision.status === 'PENDING' && (user?.role === 'MANAGER' || user?.role === 'ADMIN') ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApproval(activeDecision.id, false)}
                      className="px-3.5 py-1.5 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold transition-all"
                    >
                      Reject Brief
                    </button>
                    <button
                      onClick={() => handleApproval(activeDecision.id, true)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Approve Brief
                    </button>
                  </div>
                ) : activeDecision.status === 'PENDING' ? (
                  <span className="text-[11px] text-slate-500 font-medium italic">
                    Waiting for Manager / Admin approval.
                  </span>
                ) : null}
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="bg-white border-slate-200 flex flex-col items-center justify-center text-center p-10 min-h-[380px]" hoverEffect={false}>
              <div className="h-14 w-14 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-600 mb-3">
                <Brain className="h-7 w-7" />
              </div>
              <h4 className="text-base font-bold text-slate-900">AI Diagnostic Output</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                Type your question or click the microphone button to speak your equipment query. INDRA will retrieve grounded evidence from your documents.
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
};

export default DecisionsPage;

