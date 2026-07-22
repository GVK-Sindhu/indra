import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard.js';
import api from '../services/api.js';
import { 
  ClipboardCheck, 
  RefreshCw, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  BookOpen, 
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react';

interface ProcedureStep {
  stepNumber: number;
  instruction: string;
  validationType: 'None' | 'Measurement' | 'Visual' | 'Approval';
  measurements?: Array<{ name: string; unit: string; minLimit?: number; maxLimit?: number }>;
  safetyNote?: string;
  warning?: string;
  docReferences?: Array<{ documentId: string; pageNumber: number }>;
}

interface ProcedureRecord {
  id: string;
  name: string;
  description: string;
  assetId: string;
  steps: ProcedureStep[];
}

interface ExecutionMeasurement {
  name: string;
  value: number;
  isValid: boolean;
}

interface ExecutionStep {
  stepNumber: number;
  completed: boolean;
  completedAt?: string;
  measurements?: ExecutionMeasurement[];
  notes?: string;
  images?: string[];
}

interface ExecutionSession {
  id: string;
  procedureId: string;
  assetId: string;
  engineerId: string;
  status: 'InProgress' | 'Completed' | 'Failed';
  currentStep: number;
  steps: ExecutionStep[];
}

export const ExecutionPage: React.FC = () => {
  const [procedures, setProcedures] = useState<ProcedureRecord[]>([]);
  const [activeSession, setActiveSession] = useState<ExecutionSession | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [updatingStep, setUpdatingStep] = useState(false);
  
  // Selection state
  const [selectedProcId, setSelectedProcId] = useState('');
  
  // Active step execution inputs
  const [measValue, setMeasValue] = useState<string>('');
  const [notesText, setNotesText] = useState<string>('');
  const [stepWarning, setStepWarning] = useState<string>('');
  
  // Wrap-up Complete state
  const [outcomeText, setOutcomeText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [lessonsText, setLessonsText] = useState('');

  const loadProceduresAndSession = async () => {
    setLoading(true);
    try {
      const [procRes, sessRes] = await Promise.all([
        api.get<{ procedures: ProcedureRecord[] }>('/api/v1/execution/procedures'),
        api.get<{ session: ExecutionSession | null }>('/api/v1/execution/active')
      ]);

      setProcedures(procRes.procedures || []);
      if (procRes.procedures && procRes.procedures.length > 0) {
        setSelectedProcId(procRes.procedures[0].id);
      }

      if (sessRes.session) {
        setActiveSession(sessRes.session);
        // Pre-fill active step states
        loadActiveStepState(sessRes.session);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProceduresAndSession();
  }, []);

  const loadActiveStepState = (session: ExecutionSession) => {
    const curStep = session.steps.find(s => s.stepNumber === session.currentStep);
    if (curStep) {
      setNotesText(curStep.notes || '');
      if (curStep.measurements && curStep.measurements.length > 0) {
        setMeasValue(curStep.measurements[0].value.toString());
      } else {
        setMeasValue('');
      }
    } else {
      setNotesText('');
      setMeasValue('');
    }
    setStepWarning('');
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProcId) return;

    setStarting(true);
    try {
      const selectedProc = procedures.find(p => p.id === selectedProcId);
      if (!selectedProc) return;

      const res = await api.post<{ session: ExecutionSession }>('/api/v1/execution/start', {
        procedureId: selectedProc.id,
        assetId: selectedProc.assetId
      });

      setActiveSession(res.session);
      loadActiveStepState(res.session);
    } catch (err: any) {
      alert(`Failed to start procedure execution: ${err.message}`);
    } finally {
      setStarting(false);
    }
  };

  const handleStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    setUpdatingStep(true);
    setStepWarning('');

    const procedure = procedures.find(p => p.id === activeSession.procedureId);
    const activeStepConstraint = procedure?.steps.find(s => s.stepNumber === activeSession.currentStep);
    const measurementName = activeStepConstraint?.measurements?.[0]?.name;

    try {
      const res = await api.put<{ session: ExecutionSession; warning: string }>('/api/v1/execution/step', {
        sessionId: activeSession.id,
        stepNumber: activeSession.currentStep,
        completed: true,
        measurementName,
        measurementValue: measValue ? parseFloat(measValue) : undefined,
        notes: notesText
      });

      setActiveSession(res.session);
      
      if (res.warning) {
        setStepWarning(res.warning);
      } else {
        // Automatically load next step inputs
        loadActiveStepState(res.session);
      }

    } catch (err: any) {
      alert(`Failed to update step: ${err.message}`);
    } finally {
      setUpdatingStep(false);
    }
  };

  const handleComplete = async (status: 'complete' | 'fail') => {
    if (!activeSession || !outcomeText.trim()) return;

    try {
      const endpoint = `/api/v1/execution/${status}`;
      await api.post(endpoint, {
        sessionId: activeSession.id,
        outcome: outcomeText,
        feedback: feedbackText,
        lessonsLearned: lessonsText
      });

      // Clear states
      setActiveSession(null);
      setOutcomeText('');
      setFeedbackText('');
      setLessonsText('');
      setStepWarning('');
      
      // Reload procedures
      loadProceduresAndSession();
    } catch (err: any) {
      alert(`Failed to complete session: ${err.message}`);
    }
  };

  const getProcedureDetails = () => {
    if (!activeSession) return null;
    return procedures.find(p => p.id === activeSession.procedureId) || null;
  };

  const activeProcedure = getProcedureDetails();
  const activeStepConstraint = activeProcedure?.steps.find(s => s.stepNumber === activeSession?.currentStep);

  // Checks validation of measurements live on frontend as typing
  const getLiveValidation = () => {
    if (!activeStepConstraint || !measValue) return null;
    const meas = activeStepConstraint.measurements?.[0];
    if (!meas) return null;

    const val = parseFloat(measValue);
    if (isNaN(val)) return { isValid: false, message: 'Invalid input number' };

    let isValid = true;
    if (meas.minLimit !== undefined && val < meas.minLimit) isValid = false;
    if (meas.maxLimit !== undefined && val > meas.maxLimit) isValid = false;

    return {
      isValid,
      message: isValid 
        ? 'Reading is within safe operating limits.' 
        : `Reading violates tolerance limit (${meas.minLimit || 0} - ${meas.maxLimit || 999} ${meas.unit})!`
    };
  };

  const liveVal = getLiveValidation();

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Guided Procedure Execution</h2>
        <p className="text-slate-500 text-xs mt-1">
          Perform step-by-step checklist validations, record measurements, and log lessons learned.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-500">Loading checklist engine...</p>
        </div>
      ) : !activeSession ? (
        /* Setup / Selector view */
        <div className="max-w-xl mx-auto w-full">
          <GlassCard className="bg-white border-slate-200" hoverEffect={false}>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center text-blue-600">
                <ClipboardCheck className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Start Maintenance SOP</h3>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Select an approved procedural checklist. Starting a session initializes step-by-step audit records, validating parameters in real-time against maximum allowable operating limits compiled from technical manuals.
            </p>

            {procedures.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs border border-slate-200 bg-slate-50 rounded-xl">
                No executable procedures found in the database.
              </div>
            ) : (
              <form onSubmit={handleStart} className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Select Procedure</label>
                  <select
                    value={selectedProcId}
                    onChange={(e) => setSelectedProcId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-3.5 outline-none cursor-pointer focus:border-blue-600 font-medium"
                  >
                    {procedures.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={starting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 active:scale-95"
                >
                  {starting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Begin Execution Session
                    </>
                  )}
                </button>
              </form>
            )}
          </GlassCard>
        </div>
      ) : (
        /* Guided Step-by-Step execution */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Steps Checklist side list */}
          <GlassCard className="bg-white border-slate-200 lg:col-span-1 flex flex-col justify-between" hoverEffect={false}>
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">SOP Check sequence</h3>
              <h4 className="text-sm font-extrabold text-slate-900 mb-6 truncate">{activeProcedure?.name}</h4>
              
              <div className="flex flex-col gap-3">
                {activeProcedure?.steps.map((step) => {
                  const tracking = activeSession.steps.find(s => s.stepNumber === step.stepNumber);
                  const isCurrent = activeSession.currentStep === step.stepNumber;
                  const isCompleted = tracking?.completed || step.stepNumber < activeSession.currentStep;

                  return (
                    <div 
                      key={step.stepNumber}
                      className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all ${
                        isCurrent 
                          ? 'bg-blue-50 border-blue-200' 
                          : isCompleted 
                          ? 'bg-emerald-50 border-emerald-200 opacity-80' 
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="shrink-0 mt-0.5">
                        {isCompleted ? (
                          <CheckCircle className="h-4.5 w-4.5 text-emerald-600" />
                        ) : isCurrent ? (
                          <div className="h-4.5 w-4.5 rounded-full border-2 border-blue-600 flex items-center justify-center text-[9px] font-bold text-blue-700">
                            {step.stepNumber}
                          </div>
                        ) : (
                          <div className="h-4.5 w-4.5 rounded-full border-2 border-slate-400 flex items-center justify-center text-[9px] font-bold text-slate-500">
                            {step.stepNumber}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-relaxed line-clamp-2">{step.instruction}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>

          {/* Active Step Panel / Complete Wrap-up */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {activeSession.currentStep <= (activeProcedure?.steps.length || 0) && activeStepConstraint ? (
              /* Active Step Checklist Card */
              <GlassCard className="bg-white border-slate-200 flex flex-col gap-6" hoverEffect={false}>
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                  <span className="text-[10px] font-bold bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full text-blue-700 uppercase tracking-wider">
                    Step {activeSession.currentStep} of {activeProcedure?.steps.length}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-blue-600" />
                    Live Audit Recording
                  </span>
                </div>

                {/* Instruction */}
                <div>
                  <h4 className="text-base font-bold text-slate-900 leading-relaxed">
                    {activeStepConstraint.instruction}
                  </h4>
                </div>

                {/* Warning & Notes */}
                {(activeStepConstraint.warning || activeStepConstraint.safetyNote) && (
                  <div className="flex flex-col gap-3">
                    {activeStepConstraint.warning && (
                      <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider block">Operational Warning</span>
                          <p className="text-xs mt-0.5 leading-relaxed font-medium">{activeStepConstraint.warning}</p>
                        </div>
                      </div>
                    )}
                    {activeStepConstraint.safetyNote && (
                      <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl">
                        <Info className="h-5 w-5 shrink-0 mt-0.5 text-blue-600" />
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider block">Safety Instruction</span>
                          <p className="text-xs mt-0.5 leading-relaxed font-medium">{activeStepConstraint.safetyNote}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Document References */}
                {activeStepConstraint.docReferences && activeStepConstraint.docReferences.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold uppercase tracking-wider">References:</span>
                    {activeStepConstraint.docReferences.map((ref, idx) => (
                      <span key={idx} className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-md font-mono text-[9px]">
                        Page {ref.pageNumber}
                      </span>
                    ))}
                  </div>
                )}

                {/* Verification Form */}
                <form onSubmit={handleStepSubmit} className="flex flex-col gap-5 border-t border-slate-200 pt-6">
                  {/* Measurement validation */}
                  {activeStepConstraint.validationType === 'Measurement' && activeStepConstraint.measurements && (
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">
                        Enter Measurement Reading ({activeStepConstraint.measurements[0].name} in {activeStepConstraint.measurements[0].unit})
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          step="0.01"
                          required
                          placeholder={`e.g. 0.32`}
                          value={measValue}
                          onChange={(e) => setMeasValue(e.target.value)}
                          className={`flex-1 bg-white border text-slate-900 text-xs rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-blue-500 ${
                            liveVal 
                              ? liveVal.isValid 
                                ? 'border-emerald-500 bg-emerald-50' 
                                : 'border-rose-500 bg-rose-50'
                              : 'border-slate-300'
                          }`}
                        />
                        <span className="text-sm font-bold text-slate-600 w-12 shrink-0">
                          {activeStepConstraint.measurements[0].unit}
                        </span>
                      </div>

                      {/* Live Validation Alert Card */}
                      {liveVal && (
                        <div className={`flex items-start gap-2 p-3 rounded-xl border text-[11px] leading-relaxed mt-1 ${
                          liveVal.isValid 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}>
                          {liveVal.isValid ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />}
                          <span>{liveVal.message}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">Field Notes / Observations (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Record casing condition, any alignment drift observed..."
                      value={notesText}
                      onChange={(e) => setNotesText(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                    />
                  </div>

                  {stepWarning && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px] leading-relaxed">
                      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" />
                      <div>
                        <span className="font-bold uppercase tracking-wider block">Tolerance Alert</span>
                        <p className="mt-0.5">{stepWarning}</p>
                        <p className="mt-1 text-[9px] text-slate-500">Correct the measurement before proceeding, or log the issue to request brief override.</p>
                      </div>
                    </div>
                  )}

                  {/* Button */}
                  <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                    {stepWarning ? (
                      <button
                        type="button"
                        onClick={() => { setStepWarning(''); loadActiveStepState(activeSession); }}
                        className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all active:scale-95"
                      >
                        Adjust Measurement
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      disabled={updatingStep}
                      className="px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/10 active:scale-95 disabled:opacity-50"
                    >
                      {updatingStep ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          Save & Next Step
                          <ArrowRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </GlassCard>
            ) : (
              /* Wrap-up and Complete Checklist form */
              <GlassCard className="bg-white border-slate-200 flex flex-col gap-6" hoverEffect={false}>
                <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h4 className="text-base font-bold text-slate-900">Execution Completion Phase</h4>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  All checklist checks have been executed. To finalize and archive the session audit records, provide the outcome summaries, personnel feedbacks, and lessons learned.
                </p>

                <div className="flex flex-col gap-5 border-t border-slate-200 pt-6">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">Final Outcome Summary</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="e.g. Wear rings clearance verified at 0.35mm. Lubrication replaced. Vibration levels dropped to 1.8 mm/s."
                      value={outcomeText}
                      onChange={(e) => setOutcomeText(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">Lessons Learned</label>
                      <textarea
                        rows={3}
                        placeholder="e.g. Pump casing vent was slightly blocked; check vent pipe on step 2 in future."
                        value={lessonsText}
                        onChange={(e) => setLessonsText(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-slate-700 font-bold uppercase tracking-wider">SOP Checklist Feedback</label>
                      <textarea
                        rows={3}
                        placeholder="e.g. Clear steps. Recommend drawing tools for clearance checks."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
                    <button
                      onClick={() => handleComplete('fail')}
                      className="px-5 py-3.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                    >
                      Log Abort / Fail
                    </button>
                    <button
                      onClick={() => handleComplete('complete')}
                      disabled={!outcomeText.trim()}
                      className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Archive Audit Report
                    </button>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionPage;
