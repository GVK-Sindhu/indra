# INDRA — Current System Status & Technical Audit

**Project:** INDRA — Active Knowledge Reliability & Decision Guardrail Engine for Industrial Assets  
**Audit Date:** July 2026  
**Repository Path:** `d:/projects/indra`  
**System Scope:** Analysis of current codebase (Backend: Python FastAPI + PyMongo + ChromaDB + Gemini SDK; Frontend: React + Vite + TypeScript + TailwindCSS)

---

## Executive Summary

INDRA is designed to address knowledge fragmentation, outdated operating procedures (SOPs), and catastrophic maintenance errors in industrial plant operations. Unlike generic Retrieval-Augmented Generation (RAG) systems that blindly query unverified text chunks, INDRA introduces a **deterministic reliability framework**:
1. **Knowledge Reliability Index (KRI)**: Measures the trust and freshness of an asset's knowledge corpus.
2. **Decision Confidence Index (DCI)**: Calculates a multi-factor confidence score before releasing an AI diagnostic recommendation.
3. **Safety Abstention Guardrail**: Automatically blocks AI recommendations when data completeness or confidence falls below safety thresholds (DCI < 50%).
4. **Programmatic & LLM Contradiction Detection**: Flags conflicting operational limits across document versions (e.g., SOP v1 vs. SOP v2).

---

## 1. Problem INDRA Solves

* **Information Fragmentation**: Industrial records (OEM manuals, SOPs, work orders, P&IDs, inspection reports) are isolated across disconnected systems.
* **Knowledge Cliff**: Loss of decades of unwritten engineering knowledge as senior operators retire.
* **Unplanned Downtime & Safety Hazards**: Field engineers executing outdated or conflicting SOP instructions (e.g., applying superseded pressure or vibration limits).
* **Hallucination Risk in Industrial AI**: Generic LLMs producing plausible but false safety thresholds.

---

## 2. Current System Architecture

The current codebase is a local, non-containerized, decoupled client-server web application:
* **Frontend**: React 18, Vite, TypeScript, TailwindCSS, Lucide Icons, React Router DOM.
* **Backend**: Python 3.10/3.11, FastAPI, Uvicorn, PyMongo, PyMuPDF, PyTesseract, Google GenAI SDK (`gemini-2.5-flash`, `gemini-embedding-2`), ChromaDB PersistentClient.
* **Database Layer**: MongoDB (document store for assets, users, facts, procedures, execution sessions, decisions, alerts) + ChromaDB (vector embedding store).

*(For detailed architectural diagrams and data flow, see [`docs/ARCHITECTURE.md`](file:///d:/projects/indra/docs/ARCHITECTURE.md).)*

---

## 3. Detailed Technical Analysis

### A. Document Ingestion Pipeline
* **Entry Point**: `POST /api/v1/documents/process` ([`documents.py`](file:///d:/projects/indra/apps/backend-python/app/api/v1/documents.py#L17)) receives multipart file uploads.
* **Background Dispatch**: FastAPI `BackgroundTasks` executes `process_document_pipeline()` ([`document_service.py`](file:///d:/projects/indra/apps/backend-python/app/services/document_service.py#L18)) asynchronously.
* **Step 1 — Page Parsing**: `parse_document()` ([`document_parser.py`](file:///d:/projects/indra/apps/backend-python/app/services/document_parser.py#L95)) converts file bytes into page block data structures.
* **Step 2 — Semantic Chunking**: `chunk_document()` ([`chunker.py`](file:///d:/projects/indra/apps/backend-python/app/services/chunker.py#L1)) splits content page-by-page into 500-word sliding windows with 50-word overlap.
* **Step 3 — Bulk Embedding**: `get_embeddings_bulk()` ([`embedding_service.py`](file:///d:/projects/indra/apps/backend-python/app/services/embedding_service.py#L33)) generates vector embeddings using `gemini-embedding-2`.
* **Step 4 — Vector Indexing**: `add_chunks_to_vector_store()` ([`vector_store.py`](file:///d:/projects/indra/apps/backend-python/app/services/vector_store.py#L22)) stores chunk vectors, text, page numbers, and bounding box coordinates into ChromaDB (`indra_knowledge` collection).
* **Step 5 — MongoDB Storage**: Chunks are stored in the `documentchunks` collection for page viewer rendering.
* **Step 6 — LLM Fact & SOP Extraction**: `extract_document_intelligence()` ([`llm_service.py`](file:///d:/projects/indra/apps/backend-python/app/services/llm_service.py#L71)) calls `gemini-2.5-flash` with Pydantic JSON schema constraints to extract facts, numeric parameters, limits, hazards, parts, and SOP checklist steps.
* **Step 7 — Knowledge Compilation & Contradiction Detection**: `compile_extracted_data()` ([`knowledge_compiler.py`](file:///d:/projects/indra/apps/backend-python/app/services/knowledge_compiler.py#L7)) saves extracted items to MongoDB, runs programmatic limit contradiction checks, logs alerts, and triggers an asset KRI recalculation scan.

### B. Supported & Unsupported Formats

| Format | Extension | Backend Ingestion Status | Parser Implementation | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **PDF** | `.pdf` | **SUPPORTED (WORKING)** | PyMuPDF (`fitz`) + Tesseract OCR fallback | Native text extraction block-by-block with bounding boxes. |
| **Image** | `.png`, `.jpg`, `.jpeg` | **SUPPORTED (WORKING)** | PyTesseract OCR | Converts image bytes via PIL and runs OCR text extraction. |
| **Spreadsheets** | `.xlsx`, `.xls`, `.csv` | **NOT SUPPORTED (EXPLICIT CRASH)** | Explicitly blocked with `HTTPException` / `ValueError` | API route rejects upload; `document_parser.py` raises `ValueError`. |
| **Word Docs** | `.doc`, `.docx` | **NOT SUPPORTED (EXPLICIT CRASH)** | Explicitly blocked with `HTTPException` / `ValueError` | API route rejects upload; `document_parser.py` raises `ValueError`. |

> [!WARNING]
> While `.xlsx`, `.csv`, and `.docx` files exist in the `synthetic_indra_dataset/P-101/` directory, uploading them through the API currently causes an explicit 400 Bad Request error or backend Exception.

### C. Chunking Strategy
* **Implementation**: `chunk_document()` in [`chunker.py`](file:///d:/projects/indra/apps/backend-python/app/services/chunker.py#L1).
* **Page-Level Isolation**: Page boundaries are strictly preserved. Chunks never cross multiple pages, guaranteeing exact 1-to-1 page-level provenance.
* **Parameters**: `max_words = 500`, `overlap_words = 50`.
* **Bounding Box Calculation**: Merges bounding box coordinates `[x, y, w, h]` of contained text blocks for PDF rendering overlay.

### D. Vector Database & Embedding Model
* **Embedding Model**: Google GenAI SDK `gemini-embedding-2` (`client.models.embed_content`).
* **Vector Database**: Local ChromaDB (`chromadb.PersistentClient`) stored at `./chroma_db`.
* **Collection Name**: `indra_knowledge`.
* **Metadata Fields**: `documentId`, `documentName`, `pageNumber`, `boundingBox` (JSON stringified), `assetId`, `assetCode`.

### E. RAG Query Pipeline & Gemini LLM Integration
1. **Query Entry**: `POST /api/v1/decisions/brief` ([`decisions.py`](file:///d:/projects/indra/apps/backend-python/app/api/v1/decisions.py#L11)) receives `assetId` and `problem` string.
2. **Vectorization**: Query embedding generated via `get_embedding(problem)` using `gemini-embedding-2`.
3. **Similarity Search**: `search_similar_chunks()` ([`vector_store.py`](file:///d:/projects/indra/apps/backend-python/app/services/vector_store.py#L36)) queries ChromaDB for the top 6 closest chunks (filtering by `assetId` with a global fallback).
4. **Context Synthesis**: Assembles structured facts from MongoDB (`db.facts`), active integrity alerts (`db.integrityalerts`), and retrieved document text chunks.
5. **LLM Reasoning**: Calls `generate_decision_brief()` ([`llm_service.py`](file:///d:/projects/indra/apps/backend-python/app/services/llm_service.py#L121)) using `gemini-2.5-flash` with structured Pydantic schema `RAGDecisionBrief`.
6. **Provenance Attachment**: Replaces any LLM citations with immutable citations directly from ChromaDB search metadata (`build_retrieved_chunk_citations()`).

### F. Exact Formulas for KRI & DCI

#### 1. Knowledge Reliability Index (KRI)
Calculated in `validate_asset_integrity()` ([`knowledge_integrity.py`](file:///d:/projects/indra/apps/backend-python/app/services/knowledge_integrity.py#L76)):

$$\text{KRI} = (\text{Freshness} \times 0.30) + (\text{Consistency} \times 0.30) + (\text{Completeness} \times 0.20) + (\text{Validation} \times 0.20)$$

* **Freshness Score (30%)**: $1.0 - (\text{count of docs older than 1 yr} \times 0.15)$ (minimum 0.2).
* **Consistency Score (30%)**: $1.0 - (\text{count of contradictory facts for asset} \times 0.10)$ (minimum 0.1).
* **Completeness Score (20%)**: Base score 0.5 + (0.20 if `Limit` fact exists) + (0.15 if `Part` fact exists) + (0.15 if `Hazard` fact exists).
* **Human Validation Score (20%)**: $\frac{\text{Count of facts with status 'Validated'}}{\text{Total facts count for asset}}$ (default 1.0 if no facts exist).

#### 2. Decision Confidence Index (DCI)
Calculated in `generate_rag_decision_brief()` ([`decision_intelligence.py`](file:///d:/projects/indra/apps/backend-python/app/services/decision_intelligence.py#L96)):

$$\text{DCI} = (\text{Evidence Agreement} \times 0.40) + (\text{Historical Success} \times 0.20) + (\text{Data Completeness} \times 0.20) + (\text{Doc Freshness} \times 0.10) + (\text{Human Validation} \times 0.10)$$

* **Evidence Agreement (40%)**: Confidence returned by Gemini 2.5 Flash (`ai_brief.confidence`, default 0.8).
* **Historical Success (20%)**: $\frac{\text{Successful SOP execution sessions}}{\text{Total completed SOP execution sessions}}$ for the asset (default 0.75).
* **Data Completeness (20%)**: (0.4 if `Limit` fact present) + (0.3 if `Part` fact present) + (0.3 if `Hazard` fact present).
* **Doc Freshness (10%)**: Same calculation as KRI freshness metric (0.2 to 1.0).
* **Human Validation (10%)**: $\frac{\text{Validated facts}}{\text{Total facts}}$.

#### 3. Safety Abstention Logic
* **Threshold**: If $\text{DCI} < 50\%$, the backend returns:
  `{"success": False, "abstain": True, "message": "Unable to recommend due to insufficient validated evidence."}`
* **Manager Approval Trigger**: If $\text{DCI} < 80\%$ or Risk Level is `"Critical"` or `"High"`, `engineerApprovalRequired` is set to `True`.

### G. Cross-Document Contradiction Detection
INDRA implements a dual-layer contradiction engine in `compile_extracted_data()` ([`knowledge_compiler.py`](file:///d:/projects/indra/apps/backend-python/app/services/knowledge_compiler.py#L94)):
1. **Programmatic Contradiction Detection**: Compares numeric parameter limits (e.g., parameter `"maximum operating pressure"`, unit `"bar"`) between newly extracted facts and existing facts for the same asset. If `numericValue` differs, it automatically generates a High severity contradiction.
2. **LLM Contradiction Extraction**: Gemini 2.5 Flash compares incoming text against existing DB facts context.
3. **Database Impact**: Flagged facts are marked `status = "Contradictory"`, a `contradicts` relation is inserted in `db.relations`, an active `IntegrityAlert` is created, and the asset's KRI score drops immediately.

### H. User Roles & Authentication
* **Auth Engine**: JWT Bearer Tokens (`PyJWT`) with secret `JWT_SECRET`.
* **RBAC Enforcement**: `RequireRole` dependency class ([`dependencies.py`](file:///d:/projects/indra/apps/backend-python/app/core/dependencies.py#L64)).
* **Defined Roles**:
  * `ENGINEER`: Can generate RAG briefs, run SOP execution checklists, view documents and knowledge graphs.
  * `MANAGER`: Inherits Engineer scopes + can approve/reject decision briefs (`POST /api/v1/decisions/{id}/approve`).
  * `ADMIN`: Full system permissions.

---

## 4. Benchmark & Synthetic Dataset Analysis

* **Dataset Path**: `synthetic_indra_dataset/`
* **Assets Provided**: `P-101` (Centrifugal Feed Water Pump).
* **Files Included**:
  * `P-101_OEM_Manual.pdf` (PDF)
  * `P-101_SOP_v1_Superseded.pdf` (PDF)
  * `P-101_SOP_v2_Current.pdf` (PDF)
  * `P-101_Inspection_Warning.pdf` (PDF)
  * `P-101_Incident_RCA.docx` (DOCX — *Unsupported*)
  * `P-101_Maintenance_History.xlsx` (XLSX — *Unsupported*)
  * `P-101_Sensor_History.csv` (CSV — *Unsupported*)
  * `P-101_Nameplate.png` (PNG — *Supported*)
  * `P-101_PID_Snippet.png` (PNG — *Supported*)
  * `P-101_Asset_Metadata.json` (JSON)
* **Ground Truth Benchmark**: `ground_truth/benchmark_questions.json` contains 10 domain expert questions covering single-doc, cross-format, maintenance history, contradiction detection, asset aliases, and unsupported abstention.
* **Evaluation Runner**: **NOT IMPLEMENTED**. No `eval_benchmark.py` or automated accuracy evaluation runner currently exists in the repository.

---

## 5. Summary of Infrastructure & Test Suite

* **Docker Infrastructure**: **NOT IMPLEMENTED**. The system runs native Python FastAPI and Vite Node.js processes directly on host OS without Docker compose files.
* **Automated Unit/Integration Tests**:
  * [`test_guardrails.py`](file:///d:/projects/indra/apps/backend-python/test_guardrails.py): Standalone integration test script using FastAPI `TestClient` verifying login, document upload, KRI drop on contradiction, high-evidence decision brief generation, and low-evidence abstention.
  * [`test_contradiction.py`](file:///d:/projects/indra/apps/backend-python/test_contradiction.py): Script verifying contradiction logic on synthetic PDFs.
  * `test_embedding_dim.py`, `check_tesseract.py`, `check_openpyxl.py`: Diagnostic scripts.

---

## 6. Major Technical Findings

### A. The 5 Strongest Technical Innovations
1. **Active Knowledge Reliability Index (KRI)**: Dynamic mathematical scoring of doc freshness, consistency, completeness, and human validation.
2. **Deterministic Decision Confidence Index (DCI) & Abstention Protocol**: Hard safety floor at DCI < 50% that prevents hallucinated or dangerous recommendations.
3. **Programmatic Contradiction Compiler**: Automated detection of numeric limit mismatches across SOP versions (e.g., 10 bar vs 8 bar) with immediate alert generation.
4. **Immutable Vector Citation Provenance**: Direct retrieval bounding-box and page-number metadata attachment, bypassing LLM citation hallucinations.
5. **Interactive SOP Execution Engine with Limit Guardrails**: Field technician checklist runner that validates real-time measurement inputs against safe min/max limits.

### B. The 5 Biggest Technical Gaps
1. **Spreadsheet, CSV & Word Ingestion Crash**: `document_parser.py` throws `ValueError` for `.xlsx`, `.csv`, and `.docx` formats, blocking 3 out of 10 synthetic test files.
2. **Missing Benchmark Evaluation Suite**: No automated execution script exists to run the 10 benchmark questions and output quantitative accuracy/latency metrics.
3. **No Multimodal Vision Parsing for P&IDs**: P&ID PNG diagrams rely on basic Tesseract text OCR, missing spatial component and valve tag relationships.
4. **RAG Prompt Does Not Support Strict Abstention**: Questions 9 & 10 expect "Abstain (No data available)", but RAG prompt relies solely on ChromaDB distance rather than explicit zero-context abstention instructions.
5. **No Dockerization**: Requires manual installation of Python virtualenv, Tesseract OCR executable, Node.js, and local MongoDB instance.

### C. Features That Could Cause the Demo to Crash
1. **Uploading `.xlsx`, `.csv`, `.docx` files during live demo**: Immediately causes 400 Bad Request error or backend 500 crash.
2. **Missing Tesseract OCR binary on Windows host**: If `C:\Program Files\Tesseract-OCR\tesseract.exe` is absent, uploading scanned PDFs or images will crash with `ValueError`.
3. **Missing `GEMINI_API_KEY` in `.env`**: Backend boot will succeed, but document processing and decision brief generation will throw 500 exceptions.
4. **Missing Local MongoDB Server**: FastAPI startup seeder will crash if MongoDB is not listening at `localhost:27017`.

### D. Recommended Priority List (< 10 Hours Remaining)

1. **[CRITICAL] Implement XLSX, CSV & DOCX Parsers**: Update `document_parser.py` using `openpyxl`, `python-docx`, and `csv` so all dataset files ingest smoothly.
2. **[HIGH IMPACT] Build Benchmark Evaluation Script (`eval_benchmark.py`)**: Create a script to run the 10 benchmark questions, measure time-to-answer vs search, verify citations, and output accuracy numbers for the deck/demo.
3. **[HIGH IMPACT] Update RAG Abstention Prompt**: Instruct `gemini-2.5-flash` in `generate_decision_brief` to output explicit `Abstain (No data available)` when context lacks required facts.
4. **[MEDIUM IMPACT] Add Multimodal Gemini P&ID Tag Extraction**: Send P&ID images directly to `gemini-2.5-flash` multimodal model to extract structured equipment tags.
