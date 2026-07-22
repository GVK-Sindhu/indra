import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../components/GlassCard.js';
import api from '../services/api.js';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Tag,
  Link as LinkIcon,
  Mic,
  MicOff,
  Square,
  User,
  CheckCircle2,
  Brain
} from 'lucide-react';

interface DocumentRecord {
  id: string;
  title: string;
  type: string;
  status: string;
  processingStatus: string;
  errorMessage?: string;
  assets: string[];
  tags: string[];
  updatedAt: string;
}

const SpeechRecognition = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Upload State
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Voice Knowledge Capture State (Retiring Expert Knowledge Cliff Solution)
  const [voiceTitle, setVoiceTitle] = useState('');
  const [voiceExpert, setVoiceExpert] = useState('');
  const [voiceCategory, setVoiceCategory] = useState('TROUBLESHOOTING');
  const [voiceAssetCode, setVoiceAssetCode] = useState('GENERAL');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null);
  const [submittingVoice, setSubmittingVoice] = useState(false);
  const voiceRecognitionRef = useRef<any>(null);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ documents: DocumentRecord[] }>('/api/v1/documents');
      setDocuments(res.documents);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve documents catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    return () => {
      if (voiceRecognitionRef.current) {
        try {
          voiceRecognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('indra_token');

    try {
      const response = await fetch('/api/v1/documents/process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error?.message || 'Upload process failed.');
      }

      setFile(null);
      const fileInput = document.getElementById('file-upload-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      fetchDocuments();

      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        const checkRes = await fetch(`/api/v1/documents/status/${resJson.data.documentId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const checkJson = await checkRes.json();
        if (checkJson.success && (checkJson.data.processingStatus === 'COMPLETED' || checkJson.data.processingStatus === 'FAILED' || attempts > 10)) {
          clearInterval(interval);
          fetchDocuments();
        }
      }, 2500);

    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload and initiate processing.');
    } finally {
      setUploading(false);
    }
  };

  // Voice Recognition for Retiring Experts Knowledge Capture
  const toggleVoiceCapture = () => {
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isVoiceListening) {
      if (voiceRecognitionRef.current) {
        try {
          voiceRecognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      setIsVoiceListening(false);
      return;
    }

    setVoiceError(null);
    setVoiceSuccess(null);
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsVoiceListening(true);
      };

      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript + ' ';
        }
        setVoiceTranscript(text.trim());
      };

      recognition.onerror = (event: any) => {
        setIsVoiceListening(false);
        setVoiceError(`Voice recognition error (${event.error}). You can also type text manually.`);
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      voiceRecognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsVoiceListening(false);
      setVoiceError('Failed to initialize speech recognition.');
    }
  };

  const handleVoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voiceTranscript.trim()) {
      setVoiceError('Please record or type oral knowledge before submitting.');
      return;
    }

    if (isVoiceListening && voiceRecognitionRef.current) {
      try {
        voiceRecognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      setIsVoiceListening(false);
    }

    setSubmittingVoice(true);
    setVoiceError(null);
    setVoiceSuccess(null);

    try {
      await api.post('/api/v1/documents/voice-capture', {
        title: voiceTitle || 'Senior Expert Spoken Knowledge',
        transcript: voiceTranscript,
        expertName: voiceExpert || 'Retiring Senior Engineer',
        assetCode: voiceAssetCode,
        category: voiceCategory
      });

      setVoiceSuccess('Oral operational knowledge recorded successfully! Ingesting into RAG vector store...');
      setVoiceTitle('');
      setVoiceExpert('');
      setVoiceTranscript('');

      fetchDocuments();
    } catch (err: any) {
      setVoiceError(err.message || 'Failed to ingest oral knowledge into RAG.');
    } finally {
      setSubmittingVoice(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'FAILED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PROCESSING':
        return 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse';
      case 'PENDING':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Documents & Knowledge Sources</h2>
          <p className="text-slate-500 text-xs mt-1">
            Upload manuals, or record retiring senior experts' oral operational knowledge directly into RAG.
          </p>
        </div>
        <button
          onClick={fetchDocuments}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2 px-3 rounded-lg text-xs transition-all disabled:opacity-50 shrink-0 shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Documents
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Upload Form & Retiring Experts Voice Capture */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          {/* Retiring Expert Voice Knowledge Capture Card */}
          <GlassCard className="bg-white border-slate-200" hoverEffect={false}>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                <Mic className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Retiring Expert Voice Ingestion</h3>
                <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Avoid Knowledge Cliff</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Capture undocumented operational wisdom, troubleshooting tips, and SOP advice from senior engineers before retirement.
            </p>

            {voiceError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-3">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{voiceError}</span>
              </div>
            )}

            {voiceSuccess && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs mb-3">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{voiceSuccess}</span>
              </div>
            )}

            <form onSubmit={handleVoiceSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Topic / Knowledge Title</label>
                <input
                  type="text"
                  placeholder="e.g. Main Pump Bearing Squeal Diagnostics"
                  value={voiceTitle}
                  onChange={(e) => setVoiceTitle(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Senior Expert Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh (30 yrs exp)"
                    value={voiceExpert}
                    onChange={(e) => setVoiceExpert(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Target Asset</label>
                  <select
                    value={voiceAssetCode}
                    onChange={(e) => setVoiceAssetCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer font-medium"
                  >
                    <option value="GENERAL">General System</option>
                    <option value="PUMP-101">PUMP-101</option>
                    <option value="VALVE-202">VALVE-202</option>
                    <option value="TURBINE-301">TURBINE-301</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Spoken Knowledge Transcript</label>
                  {isVoiceListening && (
                    <span className="text-[10px] text-rose-600 font-bold animate-pulse flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                      Listening...
                    </span>
                  )}
                </div>

                <div className="relative">
                  <textarea
                    rows={4}
                    required
                    placeholder="Click microphone button to record expert speaking or type text..."
                    value={voiceTranscript}
                    onChange={(e) => setVoiceTranscript(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 pr-10 text-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed"
                  />

                  <button
                    type="button"
                    onClick={toggleVoiceCapture}
                    title={isVoiceListening ? "Stop listening" : "Click to speak oral knowledge"}
                    className={`absolute right-2 bottom-3 p-1.5 rounded-lg transition-all ${
                      isVoiceListening
                        ? 'bg-rose-600 text-white hover:bg-rose-700 animate-pulse'
                        : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 border border-slate-200'
                    }`}
                  >
                    {isVoiceListening ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingVoice || !voiceTranscript.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm mt-1"
              >
                {submittingVoice ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ingesting Oral Knowledge into RAG...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4" />
                    Ingest Spoken Knowledge to RAG
                  </>
                )}
              </button>
            </form>
          </GlassCard>

          {/* Standard Document Upload Panel */}
          <GlassCard className="bg-white border-slate-200 h-fit flex flex-col justify-between" hoverEffect={false}>
            <div>
              <h3 className="text-base font-bold text-slate-900 mb-2">Upload Technical Document</h3>
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                Upload PDFs, inspection Excel sheets, or images to extract structured rules.
              </p>

              <form onSubmit={handleUpload} className="flex flex-col gap-4">
                <div className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-xl bg-slate-50 cursor-pointer relative group transition-all">
                  <input
                    type="file"
                    id="file-upload-input"
                    onChange={handleFileChange}
                    accept=".pdf,image/*,.xlsx,.xls,.txt,.log,.md"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="h-7 w-7 text-slate-400 group-hover:text-blue-600 transition-colors mb-2" />
                  <span className="text-xs font-bold text-slate-800 text-center">
                    {file ? file.name : 'Click or Drag file to select'}
                  </span>
                  <span className="text-[10px] text-slate-500 text-center mt-1">
                    PDF, Text, Images, or Excel files
                  </span>
                </div>

                {uploadError && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!file || uploading}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing File...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload & Ingest File
                    </>
                  )}
                </button>
              </form>
            </div>
          </GlassCard>
        </div>

        {/* Processed Documents List */}
        <GlassCard className="bg-white border-slate-200 lg:col-span-2 flex flex-col justify-between" hoverEffect={false}>
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-4">Document Library</h3>
            
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-4">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                <p className="text-xs text-slate-500">Loading documents catalog...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                No processed documents found in the database. Upload one to begin.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {documents.map((doc) => (
                  <div 
                    key={doc.id}
                    className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 shrink-0 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center text-blue-600">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{doc.title}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Type: {doc.type} • Updated: {new Date(doc.updatedAt).toLocaleDateString()}
                        </p>

                        {/* Linked Assets */}
                        {doc.assets && doc.assets.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[10px] text-slate-500 font-semibold">Assets:</span>
                            <div className="flex flex-wrap gap-1">
                              {doc.assets.map((ast, i) => (
                                <span key={i} className="text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                  <LinkIcon className="h-2.5 w-2.5" />
                                  {ast}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Error Message */}
                        {doc.processingStatus === 'FAILED' && doc.errorMessage && (
                          <div className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px]">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{doc.errorMessage}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[10px] font-bold rounded-md uppercase tracking-wide ${getStatusBadge(doc.processingStatus)}`}>
                        {doc.processingStatus === 'COMPLETED' ? (
                          <CheckCircle className="h-3 w-3" />
                        ) : doc.processingStatus === 'FAILED' ? (
                          <AlertCircle className="h-3 w-3" />
                        ) : doc.processingStatus === 'PROCESSING' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        {doc.processingStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default DocumentsPage;

