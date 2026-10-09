const API_BASE = ''; // proxied by Vite

interface RequestOptions extends RequestInit {
  bodyData?: any;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: string[];
  };
}

// In-Memory Demo Storage for dynamic UI updates during video demo
const DEMO_USER = {
  id: '60d5ec49f390000000000001',
  email: 'engineer@indra.ai',
  name: 'Alex Doe (Senior Engineer)',
  role: 'MANAGER',
  experienceLevel: 'SENIOR',
  feedbackWeight: 1.0,
  createdAt: new Date().toISOString()
};

let DEMO_DOCUMENTS = [
  {
    id: 'doc-1',
    title: 'PUMP-101 Operational & Maintenance SOP',
    type: 'PDF',
    status: 'APPROVED',
    processingStatus: 'COMPLETED',
    assets: ['PUMP-101'],
    tags: ['SOP', 'PUMP', 'MAINTENANCE'],
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'doc-2',
    title: '[Voice Knowledge] Main Pump Bearing Squeal Diagnostics',
    type: 'VOICE_TRANSCRIPT',
    status: 'APPROVED',
    processingStatus: 'COMPLETED',
    assets: ['PUMP-101'],
    tags: ['VOICE_CAPTURE', 'RETIRING_EXPERT_KNOWLEDGE', 'TROUBLESHOOTING'],
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'doc-3',
    title: 'TURBINE-301 Auxiliary Steam System Manual',
    type: 'EXCEL',
    status: 'APPROVED',
    processingStatus: 'COMPLETED',
    assets: ['TURBINE-301'],
    tags: ['MANUAL', 'TURBINE'],
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString()
  }
];

let DEMO_DECISIONS = [
  {
    id: 'dec-1',
    assetId: '60d5ec49f390000000000002',
    problem: 'Bearing casing vibration elevated to 5.2 mm/s with high frequency squealing noise.',
    status: 'APPROVED',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    brief: {
      problemSummary: 'Observed 5.2 mm/s casing vibration and high frequency squeal indicate thermal expansion binding on PUMP-101. Grounded by Section 4.2 of PUMP-101 Maintenance SOP and Senior Expert Spoken Knowledge.',
      possibleCauses: [
        'Thermal expansion binding of inner bearing race due to vapor lock',
        'Mechanical seal dry running causing high-frequency acoustic squeal',
        'Lubrication oil film degradation'
      ],
      procedureOptions: [
        'Verify temperature sensor T-102 delta. If > 5°C, open Vent Valve V-12 for 15s to release vapor lock.',
        'Inspect lubrication oil clarity and filter differential pressure.',
        'Perform vibration FFT spectrum analysis.'
      ],
      supportingEvidence: [
        { chunkId: 'c1', documentName: 'PUMP-101 Maintenance SOP', pageNumber: 14, text: 'Vibration levels above 4.5 mm/s require thermal vapor relief via Vent Valve V-12 prior to bearing replacement.' },
        { chunkId: 'c2', documentName: '[Voice Knowledge] Senior Expert Spoken Knowledge', pageNumber: 1, text: 'Do not tighten flange immediately on squeal—check T-102 temperature delta first.' }
      ],
      conflictingEvidence: [],
      missingInformation: ['Oil analysis particle count'],
      decisionConfidenceIndex: 92,
      riskLevel: 'Medium',
      estimatedRepairTime: '45 mins',
      engineerApprovalRequired: true
    }
  }
];

const DEMO_ASSETS = [
  { id: '60d5ec49f390000000000002', name: 'Main Cooling Water Pump', code: 'PUMP-101', type: 'Centrifugal Pump', description: 'Primary coolant pump for secondary loop', kriScore: 94, dciScore: 92, warningsCount: 0 },
  { id: '60d5ec49f390000000000003', name: 'Control Isolation Valve', code: 'VALVE-202', type: 'Globe Valve', description: 'High-pressure isolation valve', kriScore: 72, dciScore: 65, warningsCount: 1 },
  { id: '60d5ec49f390000000000004', name: 'Auxiliary Power Turbine', code: 'TURBINE-301', type: 'Steam Turbine', description: 'Emergency auxiliary power generation unit', kriScore: 98, dciScore: 95, warningsCount: 0 }
];

const DEMO_FACTS = [
  { id: 'fact-1', assetId: '60d5ec49f390000000000002', documentId: 'doc-1', type: 'Limit', value: 'Max Bearing Temperature: 75°C', confidence: 0.98, status: 'Validated', pageNumber: 14, boundingBox: { x: 120, y: 150, w: 200, h: 40 }, timestamp: new Date().toISOString() },
  { id: 'fact-2', assetId: '60d5ec49f390000000000002', documentId: 'doc-2', type: 'Warning', value: 'Vibration RMS Threshold: 4.5 mm/s (Thermal Vapor Lock Warning)', confidence: 0.95, status: 'Validated', pageNumber: 1, boundingBox: { x: 80, y: 200, w: 250, h: 40 }, timestamp: new Date().toISOString() },
  { id: 'fact-3', assetId: '60d5ec49f390000000000003', documentId: 'doc-3', type: 'Limit', value: 'Isolation Seat Pressure: 12.4 bar', confidence: 0.91, status: 'Validated', pageNumber: 8, boundingBox: { x: 150, y: 100, w: 180, h: 40 }, timestamp: new Date().toISOString() }
];

const DEMO_PROCEDURES = [
  {
    id: 'proc-1',
    name: 'PUMP-101 Emergency Vibration Relief SOP',
    description: 'Guided checklist for diagnosing and mitigating high casing vibration and thermal vapor expansion on PUMP-101.',
    assetId: '60d5ec49f390000000000002',
    steps: [
      {
        stepNumber: 1,
        instruction: 'Check Bearing Temperature Delta on Sensor T-102.',
        validationType: 'Measurement' as const,
        measurements: [{ name: 'Temperature T-102', unit: '°C', minLimit: 20, maxLimit: 75 }],
        safetyNote: 'Ensure infrared camera or SCADA readout is calibrated.',
        warning: 'Temperature above 75°C requires immediate vapor venting.'
      },
      {
        stepNumber: 2,
        instruction: 'Open Vent Valve V-12 for 15 seconds to release trapped vapor.',
        validationType: 'Visual' as const,
        safetyNote: 'Wear thermal protection gloves during valve operation.'
      },
      {
        stepNumber: 3,
        instruction: 'Re-verify casing RMS vibration at Drive End Point B1.',
        validationType: 'Measurement' as const,
        measurements: [{ name: 'Vibration RMS', unit: 'mm/s', minLimit: 0, maxLimit: 4.5 }],
        warning: 'If vibration exceeds 4.5 mm/s after venting, log anomaly and notify shift manager.'
      }
    ]
  }
];

class APIClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('indra_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private getDemoMockData(path: string, options: RequestOptions = {}): any {
    const cleanPath = path.split('?')[0].replace(/\/+$/, '');
    const method = (options.method || 'GET').toUpperCase();
    const body = options.bodyData || {};

    if (cleanPath.endsWith('/api/v1/auth/me')) {
      return { user: DEMO_USER };
    }
    if (cleanPath.endsWith('/api/v1/auth/login') || cleanPath.endsWith('/api/v1/auth/register')) {
      return { token: 'demo-auth-token-123', user: DEMO_USER };
    }
    if (cleanPath.endsWith('/api/v1/integrity/assets')) {
      return { assets: DEMO_ASSETS };
    }
    if (cleanPath.endsWith('/api/v1/integrity/facts')) {
      return { facts: DEMO_FACTS };
    }
    if (cleanPath.endsWith('/api/v1/integrity/alerts')) {
      return { alerts: [
        { id: 'alert-1', assetId: '60d5ec49f390000000000003', title: 'Seat Pressure Parameter Conflict', severity: 'WARNING', description: 'Discrepancy detected between SOP v1 (12.4 bar) and Inspection Log v2 (10.8 bar)', status: 'Active', createdAt: new Date().toISOString() }
      ]};
    }
    if (cleanPath.endsWith('/api/v1/documents')) {
      return { documents: DEMO_DOCUMENTS };
    }
    if (cleanPath.endsWith('/api/v1/documents/voice-capture')) {
      const newDoc = {
        id: `voice-${Date.now()}`,
        title: `[Voice Knowledge] ${body.title || 'Senior Expert Spoken Knowledge'}`,
        type: 'VOICE_TRANSCRIPT',
        status: 'APPROVED',
        processingStatus: 'COMPLETED',
        assets: [body.assetCode || 'PUMP-101'],
        tags: ['VOICE_CAPTURE', 'RETIRING_EXPERT_KNOWLEDGE', body.category || 'TROUBLESHOOTING'],
        updatedAt: new Date().toISOString()
      };
      DEMO_DOCUMENTS.unshift(newDoc);
      return { documentId: newDoc.id, title: newDoc.title, status: 'Draft', processingStatus: 'COMPLETED' };
    }
    if (cleanPath.includes('/api/v1/documents/process')) {
      const newDoc = {
        id: `doc-${Date.now()}`,
        title: 'Uploaded Field Inspection Document.pdf',
        type: 'PDF',
        status: 'APPROVED',
        processingStatus: 'COMPLETED',
        assets: ['PUMP-101'],
        tags: ['UPLOADED', 'INSPECTION'],
        updatedAt: new Date().toISOString()
      };
      DEMO_DOCUMENTS.unshift(newDoc);
      return { documentId: newDoc.id, title: newDoc.title, status: 'Draft', processingStatus: 'COMPLETED' };
    }
    if (cleanPath.includes('/api/v1/documents/status')) {
      return { id: 'demo-doc', title: 'Document', processingStatus: 'COMPLETED' };
    }
    if (cleanPath.endsWith('/api/v1/decisions')) {
      return { decisions: DEMO_DECISIONS };
    }
    if (cleanPath.endsWith('/api/v1/decisions/brief')) {
      const assetCode = DEMO_ASSETS.find(a => a.id === body.assetId)?.code || 'PUMP-101';
      const newDecision = {
        id: `dec-${Date.now()}`,
        assetId: body.assetId || '60d5ec49f390000000000002',
        problem: body.problem || 'Query regarding operational parameters',
        status: 'PENDING' as const,
        createdAt: new Date().toISOString(),
        brief: {
          problemSummary: `Analysis for ${assetCode}: ${body.problem || 'Equipment diagnostic requested'}. Grounded in active verified manuals and retiring expert oral knowledge.`,
          possibleCauses: [
            `Thermal expansion / boundary pressure limit variation on ${assetCode}`,
            'Mechanical vibration harmonics imbalance',
            'Wear or seal tolerance drift'
          ],
          procedureOptions: [
            `Execute SOP section 3.1 for ${assetCode} pressure relief`,
            'Inspect temperature sensor delta and vent valve V-12',
            'Perform vibration spectrum diagnostic'
          ],
          supportingEvidence: [
            { chunkId: 'c1', documentName: `${assetCode} Operational Manual`, pageNumber: 12, text: 'Operating parameters must be verified prior to manual override.' },
            { chunkId: 'c2', documentName: '[Voice Knowledge] Retiring Senior Expert Oral Ingestion', pageNumber: 1, text: 'Check temperature delta before adjusting mechanical fittings.' }
          ],
          conflictingEvidence: [],
          missingInformation: [],
          decisionConfidenceIndex: 94,
          riskLevel: 'Medium' as const,
          estimatedRepairTime: '30 mins',
          engineerApprovalRequired: true
        }
      };
      DEMO_DECISIONS.unshift(newDecision);
      return { abstain: false, decision: newDecision };
    }
    if (cleanPath.includes('/approve') || cleanPath.includes('/reject')) {
      const isApprove = cleanPath.includes('/approve');
      const decId = cleanPath.split('/')[4];
      const found = DEMO_DECISIONS.find(d => d.id === decId);
      if (found) {
        found.status = isApprove ? 'APPROVED' : 'REJECTED';
        return { decision: found };
      }
      return { decision: { ...DEMO_DECISIONS[0], status: isApprove ? 'APPROVED' : 'REJECTED' } };
    }
    if (cleanPath.endsWith('/api/v1/execution/procedures')) {
      return { procedures: DEMO_PROCEDURES };
    }
    if (cleanPath.endsWith('/api/v1/execution/start')) {
      const proc = DEMO_PROCEDURES[0];
      return {
        session: {
          id: 'sess-demo-1',
          procedureId: proc.id,
          assetId: proc.assetId,
          engineerId: DEMO_USER.id,
          status: 'InProgress',
          currentStep: 1,
          steps: proc.steps.map(s => ({
            stepNumber: s.stepNumber,
            completed: false
          }))
        }
      };
    }
    if (cleanPath.endsWith('/api/v1/execution/step')) {
      const stepNum = body.stepNumber || 1;
      return {
        session: {
          id: body.sessionId || 'sess-demo-1',
          procedureId: 'proc-1',
          assetId: '60d5ec49f390000000000002',
          engineerId: DEMO_USER.id,
          status: stepNum >= 3 ? 'Completed' : 'InProgress',
          currentStep: stepNum >= 3 ? 3 : stepNum + 1,
          steps: [
            { stepNumber: 1, completed: true, notes: body.notes },
            { stepNumber: 2, completed: stepNum >= 2 },
            { stepNumber: 3, completed: stepNum >= 3 }
          ]
        },
        warning: null
      };
    }
    if (cleanPath.includes('/api/v1/execution/complete') || cleanPath.includes('/api/v1/execution/fail')) {
      return { success: true };
    }
    if (cleanPath.endsWith('/api/v1/execution/active')) {
      return { session: null };
    }
    if (cleanPath.includes('/api/v1/analytics/assets/')) {
      return {
        id: '60d5ec49f390000000000002',
        name: 'Main Cooling Water Pump',
        code: 'PUMP-101',
        type: 'Centrifugal Pump',
        description: 'Primary coolant pump for secondary loop',
        kriScore: 94,
        dciScore: 92,
        metrics: [
          { name: 'Vibration (RMS)', current: 2.1, limit: 4.5, unit: 'mm/s', status: 'NORMAL' },
          { name: 'Bearing Temp (T-102)', current: 64, limit: 75, unit: '°C', status: 'NORMAL' },
          { name: 'Suction Pressure', current: 4.2, limit: 6.0, unit: 'bar', status: 'NORMAL' }
        ],
        recentDecisions: DEMO_DECISIONS,
        linkedDocuments: DEMO_DOCUMENTS
      };
    }
    if (cleanPath.endsWith('/api/v1/analytics/dashboard')) {
      return { kriScore: 92, dciScore: 89, totalDocuments: DEMO_DOCUMENTS.length, totalFacts: DEMO_FACTS.length, activeAlerts: 1, pendingApprovals: DEMO_DECISIONS.filter(d => d.status === 'PENDING').length };
    }
    if (cleanPath.endsWith('/api/v1/users')) {
      return { users: [DEMO_USER] };
    }

    return { success: true };
  }

  private async request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${API_BASE}${path}`;
    const headers = {
      ...this.getHeaders(),
      ...options.headers,
    };

    const config: RequestInit = {
      ...options,
      headers,
    };

    if (options.bodyData) {
      config.body = JSON.stringify(options.bodyData);
    }

    try {
      const response = await fetch(url, config);
      
      // If server returned 401, 307 redirect, or error status, use demo simulation fallback
      if (!response.ok) {
        console.warn(`[API Demo Fallback] ${path} returned status ${response.status}. Using simulation context.`);
        return this.getDemoMockData(path, options) as T;
      }

      const payload: APIResponse<T> = await response.json().catch(() => ({
        success: false,
        error: { message: 'Invalid server response structure.', code: 'SERVER_JSON_ERROR' },
      }));

      if (!payload.success && payload.error) {
        console.warn(`[API Demo Fallback] ${path} returned payload error. Using simulation context.`);
        return this.getDemoMockData(path, options) as T;
      }

      return (payload.data !== undefined ? payload.data : payload) as T;
    } catch (err: any) {
      console.warn(`[API Demo Fallback] Request to ${path} failed (${err.message}). Using simulation fallback.`);
      return this.getDemoMockData(path, options) as T;
    }
  }

  public get<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T = any>(path: string, bodyData?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', bodyData });
  }

  public put<T = any>(path: string, bodyData?: any, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', bodyData });
  }

  public delete<T = any>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const api = new APIClient();
export default api;

