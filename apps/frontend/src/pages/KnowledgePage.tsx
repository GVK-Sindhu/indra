import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard.js';
import api from '../services/api.js';
import { 
  BookOpen, 
  Search, 
  FileText, 
  ShieldAlert, 
  Link2,
  Bookmark,
  Target,
  Clock,
  Sparkles,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface FactRecord {
  id: string;
  type: string;
  value: string;
  assetId: string;
  documentId: string;
  pageNumber: number;
  boundingBox?: { x: number; y: number; w: number; h: number };
  confidence: number;
  status: 'Validated' | 'Unvalidated' | 'Contradictory';
  timestamp: string;
}

interface AssetRecord {
  id: string;
  name: string;
  code: string;
}

interface DocumentRecord {
  id: string;
  title: string;
}

export const KnowledgePage: React.FC = () => {
  const [facts, setFacts] = useState<FactRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [assetFilter, setAssetFilter] = useState('ALL');
  
  // Selected Fact (for details side panel)
  const [selectedFact, setSelectedFact] = useState<FactRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [factsRes, assetsRes, docsRes] = await Promise.all([
        api.get<{ facts: FactRecord[] }>('/api/v1/integrity/facts'),
        api.get<{ assets: AssetRecord[] }>('/api/v1/integrity/assets'), // reuses assets route
        api.get<{ documents: DocumentRecord[] }>('/api/v1/documents')
      ]);
      
      setFacts(factsRes.facts || []);
      setAssets(assetsRes.assets || []);
      setDocuments(docsRes.documents || []);

      if (factsRes.facts && factsRes.facts.length > 0) {
        setSelectedFact(factsRes.facts[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load compiled knowledge base telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getFactTypeIcon = (type: string) => {
    switch (type) {
      case 'Limit':
        return <Target className="h-4 w-4 text-cyan-400" />;
      case 'Hazard':
        return <ShieldAlert className="h-4 w-4 text-rose-400" />;
      case 'Warning':
        return <ShieldAlert className="h-4 w-4 text-amber-400" />;
      case 'Procedure':
        return <Bookmark className="h-4 w-4 text-emerald-400" />;
      case 'Part':
        return <Sparkles className="h-4 w-4 text-purple-400" />;
      default:
        return <BookOpen className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Validated':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Contradictory':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'Unvalidated':
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.9) return 'text-emerald-400';
    if (conf >= 0.75) return 'text-amber-400';
    return 'text-rose-400';
  };

  // Filtered Facts
  const filteredFacts = facts.filter(f => {
    const matchesSearch = f.value.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'ALL' || f.type === typeFilter;
    
    let matchesAsset = true;
    if (assetFilter !== 'ALL') {
      matchesAsset = f.assetId === assetFilter;
    }

    return matchesSearch && matchesType && matchesAsset;
  });

  const getDocumentTitle = (docId: string) => {
    return documents.find(d => d.id === docId)?.title || 'Reference Manual';
  };

  const getAssetCode = (aId: string) => {
    return assets.find(a => a.id === aId)?.code || 'UNKNOWN';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Integrity Alerts & Knowledge Base</h2>
          <p className="text-slate-500 text-xs mt-1">
            Browse normalized structured facts, logical relations, and visual coordinate annotations.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs transition-all disabled:opacity-50 shrink-0 shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Re-Compile Facts
        </button>
      </div>

      {/* Filter Sandbox */}
      <GlassCard className="bg-white border-slate-200 flex flex-wrap items-center justify-between gap-4 p-4" hoverEffect={false}>
        <div className="flex flex-1 min-w-[200px] items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input 
            type="text" 
            placeholder="Search compiled facts..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none text-slate-900 placeholder:text-slate-400 text-xs outline-none w-full"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Asset filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Asset:</span>
            <select
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
            >
              <option value="ALL">All Assets</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.code}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="Limit">Operating Limit</option>
              <option value="Hazard">Hazards</option>
              <option value="Warning">Warnings</option>
              <option value="Procedure">Procedure Steps</option>
              <option value="Part">Spare Parts</option>
              <option value="Engineer">Personnel</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-500">Syncing with MongoDB compiler...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Facts list */}
          <GlassCard className="bg-white border-slate-200 lg:col-span-2 flex flex-col justify-between" hoverEffect={false}>
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-slate-900">Compiled Facts ({filteredFacts.length})</h3>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Compiler v1.2</span>
              </div>

              {filteredFacts.length === 0 ? (
                <div className="text-center py-20 text-slate-500 text-xs">
                  No facts match current filter parameters.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {filteredFacts.map((fact) => (
                    <div 
                      key={fact.id}
                      onClick={() => setSelectedFact(fact)}
                      className={`py-4 px-3 rounded-xl transition-all cursor-pointer flex items-start justify-between gap-4 ${
                        selectedFact?.id === fact.id 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          {getFactTypeIcon(fact.type)}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900 leading-relaxed">{fact.value}</p>
                          <div className="flex items-center gap-3 mt-2.5 text-[10px] text-slate-500 font-medium">
                            <span className="bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase">
                              {fact.type}
                            </span>
                            <span>Asset: <strong className="text-blue-700">{getAssetCode(fact.assetId)}</strong></span>
                            <span>Page Ref: <strong className="text-slate-700">{fact.pageNumber}</strong></span>
                            <span>Confidence: <strong className={getConfidenceColor(fact.confidence)}>{Math.round(fact.confidence * 100)}%</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`px-2 py-0.5 border text-[9px] font-bold rounded-full uppercase tracking-wider ${getStatusBadge(fact.status)}`}>
                          {fact.status}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>

          {/* Details & Bounding Box annotation sandbox */}
          <GlassCard className="bg-white border-slate-200 h-fit flex flex-col justify-between" hoverEffect={false}>
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-6">Source Verification & Bounding Box</h3>
              {selectedFact ? (
                <div className="flex flex-col gap-6">
                  {/* Visual Mock of Document Page */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Visual Page Alignment (Pg {selectedFact.pageNumber})</span>
                    <div className="relative h-60 w-full bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center">
                      {/* Grid background */}
                      <div className="absolute inset-0 bg-[radial-gradient(#0000000a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
                      
                      {/* Simulated Bounding Box */}
                      {selectedFact.boundingBox ? (
                        <div 
                          className="absolute bg-blue-500/10 border-2 border-blue-600 rounded-lg flex flex-col items-center justify-center"
                          style={{
                            left: `${(selectedFact.boundingBox.x / 500) * 100}%`,
                            top: `${(selectedFact.boundingBox.y / 400) * 100}%`,
                            width: `${(selectedFact.boundingBox.w / 500) * 100}%`,
                            height: '40px'
                          }}
                        >
                          <span className="text-[8px] bg-blue-600 text-white font-bold uppercase px-1 py-0.5 rounded-sm absolute -top-4 left-0">
                            Coordinate Lock
                          </span>
                        </div>
                      ) : (
                        <div className="text-center p-6 text-slate-500 text-xs">
                          No coordinate bounding box registered.
                        </div>
                      )}
                      <div className="absolute bottom-3 right-3 text-[9px] bg-slate-900 border border-slate-800 px-2 py-1 rounded-md text-slate-300 font-mono">
                        Dim: 500 x 400 px
                      </div>
                    </div>
                  </div>

                  {/* Telemetry info */}
                  <div className="flex flex-col gap-4 border-t border-slate-200 pt-6">
                    <div className="flex items-start gap-2.5">
                      <FileText className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Source Document</span>
                        <span className="text-xs font-bold text-slate-900">{getDocumentTitle(selectedFact.documentId)}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Link2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Fact Confidence Score</span>
                        <span className={`text-xs font-bold ${getConfidenceColor(selectedFact.confidence)}`}>
                          {Math.round(selectedFact.confidence * 100)}% reliability tier
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Compiled Timestamp</span>
                        <span className="text-xs text-slate-700">
                          {new Date(selectedFact.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-slate-500 text-xs">
                  Select a fact on the left to inspect its visual OCR coordinates.
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

export default KnowledgePage;
