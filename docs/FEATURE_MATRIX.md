# INDRA — Comprehensive Feature Matrix

**Status Key:**
* `WORKING`: Implemented, tested, and verified in active code.
* `PARTIAL`: Partially implemented or functional with limitations.
* `NOT IMPLEMENTED`: Not present in current codebase or explicitly blocked.
* `UNVERIFIED`: Present in code but unverified against live external dependency.

---

## Feature Capability Matrix

| Feature Area | Feature Description | Status | Responsible Files & Functions | Notes / Constraints |
| :--- | :--- | :--- | :--- | :--- |
| **Document Ingestion** | PDF Native Text Parsing | `WORKING` | [`document_parser.py`](file:///d:/projects/indra/apps/backend-python/app/services/document_parser.py#L23) (`parse_pdf`) | Uses PyMuPDF (`fitz`) to extract block-level text and bounding boxes. |
| **Document Ingestion** | Image / Scanned Form OCR | `WORKING` | [`document_parser.py`](file:///d:/projects/indra/apps/backend-python/app/services/document_parser.py#L102) (`parse_document`) | Uses PyTesseract OCR for `.png`, `.jpg`, `.jpeg`. Requires Tesseract runtime. |
| **Document Ingestion** | Spreadsheet (.xlsx / .csv) Ingestion | `NOT IMPLEMENTED` | [`document_parser.py`](file:///d:/projects/indra/apps/backend-python/app/services/document_parser.py#L133) (`parse_document`) | Explicitly raises `ValueError("Format not currently supported in this prototype.")`. |
| **Document Ingestion** | Word (.docx) Ingestion | `NOT IMPLEMENTED` | [`document_parser.py`](file:///d:/projects/indra/apps/backend-python/app/services/document_parser.py#L137) (`parse_document`) | Explicitly raises `ValueError("Format not currently supported in this prototype.")`. |
| **Ingestion Pipeline** | Background Task Execution | `WORKING` | [`documents.py`](file:///d:/projects/indra/apps/backend-python/app/api/v1/documents.py#L124) (`process_document`) | Offloads document processing to FastAPI `BackgroundTasks`. |
| **Chunking & Indexing** | Page-Bounded Chunking | `WORKING` | [`chunker.py`](file:///d:/projects/indra/apps/backend-python/app/services/chunker.py#L1) (`chunk_document`) | Chunks text page-by-page (500 words, 50 overlap) keeping exact page number. |
| **Vector Store** | Local Persistent Vector Search | `WORKING` | [`vector_store.py`](file:///d:/projects/indra/apps/backend-python/app/services/vector_store.py#L10) (`get_chroma_client`) | Local ChromaDB (`PersistentClient`) collection `indra_knowledge`. |
| **Embeddings** | Bulk Vector Embedding Generation | `WORKING` | [`embedding_service.py`](file:///d:/projects/indra/apps/backend-python/app/services/embedding_service.py#L33) (`get_embeddings_bulk`) | Uses Google GenAI SDK `gemini-embedding-2`. |
| **LLM Reasoning** | Structured Information Extraction | `WORKING` | [`llm_service.py`](file:///d:/projects/indra/apps/backend-python/app/services/llm_service.py#L71) (`extract_document_intelligence`) | Uses `gemini-2.5-flash` with strict Pydantic JSON schemas. |
| **Knowledge Graph** | Fact & SOP Compilation | `WORKING` | [`knowledge_compiler.py`](file:///d:/projects/indra/apps/backend-python/app/services/knowledge_compiler.py#L7) (`compile_extracted_data`) | Compiles extracted limits, parts, hazards, and SOP steps into MongoDB. |
| **Knowledge Reliability**| Programmatic Limit Contradiction Detection | `WORKING` | [`knowledge_compiler.py`](file:///d:/projects/indra/apps/backend-python/app/services/knowledge_compiler.py#L95) (`compile_extracted_data`) | Automatically detects numeric threshold discrepancies between SOP versions. |
| **Knowledge Reliability**| Knowledge Reliability Index (KRI) | `WORKING` | [`knowledge_integrity.py`](file:///d:/projects/indra/apps/backend-python/app/services/knowledge_integrity.py#L6) (`validate_asset_integrity`) | Deterministic mathematical scoring (30% Freshness, 30% Consistency, 20% Completeness, 20% Validation). |
| **Decision Intel** | Decision Confidence Index (DCI) | `WORKING` | [`decision_intelligence.py`](file:///d:/projects/indra/apps/backend-python/app/services/decision_intelligence.py#L62) (`generate_rag_decision_brief`) | Weighted multi-factor confidence scoring (40% Evidence, 20% Success, 20% Completeness, 10% Freshness, 10% Validation). |
| **Decision Intel** | Safety Abstention Guardrail | `WORKING` | [`decision_intelligence.py`](file:///d:/projects/indra/apps/backend-python/app/services/decision_intelligence.py#L104) (`generate_rag_decision_brief`) | Hard safety floor: Refuses recommendation if DCI < 50%. |
| **Decision Intel** | Immutable Citation Provenance | `WORKING` | [`decision_intelligence.py`](file:///d:/projects/indra/apps/backend-python/app/services/decision_intelligence.py#L10) (`build_retrieved_chunk_citations`) | Replaces LLM text citations with exact ChromaDB bounding box and page metadata. |
| **Field Execution** | Interactive SOP Checklist Session | `WORKING` | [`execution_service.py`](file:///d:/projects/indra/apps/backend-python/app/services/execution_service.py#L7) (`start_execution_session`) | Allows technicians to start/resume guided SOP checklist runs. |
| **Field Execution** | Numeric Measurement Bounds Validation | `WORKING` | [`execution_service.py`](file:///d:/projects/indra/apps/backend-python/app/services/execution_service.py#L61) (`validate_execution_step`) | Checks technician inputs against min/max limits and raises real-time warnings. |
| **Governance** | Manager Approval / Rejection Workflow | `WORKING` | [`decisions.py`](file:///d:/projects/indra/apps/backend-python/app/api/v1/decisions.py#L79) (`approve_decision`) | Enforces role check (`MANAGER`/`ADMIN`) to approve high-risk decision briefs. |
| **Security & Auth** | JWT Authentication & RBAC | `WORKING` | [`dependencies.py`](file:///d:/projects/indra/apps/backend-python/app/core/dependencies.py#L12) (`get_current_user`) | JWT Bearer verification and `RequireRole` route guard factory. |
| **UI Experience** | Multi-Role Dashboards | `WORKING` | [`App.tsx`](file:///d:/projects/indra/apps/frontend/src/App.tsx#L88), `Dashboard.tsx` | Specialized view layouts for Engineers, Managers, and Admins. |
| **UI Experience** | 360-Degree Asset Detail Profile | `WORKING` | [`AssetDetailPage.tsx`](file:///d:/projects/indra/apps/frontend/src/pages/AssetDetailPage.tsx#L1) | Displays KRI metrics, DCI history, active alerts, facts graph, and linked SOPs. |
| **Vision Intelligence**| Multimodal P&ID Tag Extraction | `PARTIAL` | [`document_parser.py`](file:///d:/projects/indra/apps/backend-python/app/services/document_parser.py#L102) (`parse_document`) | Uses text OCR on images, but does not invoke multimodal vision for spatial P&ID tag graph creation. |
| **RAG Abstention** | Zero-Context Out-of-Corpus Abstention | `PARTIAL` | [`llm_service.py`](file:///d:/projects/indra/apps/backend-python/app/services/llm_service.py#L121) (`generate_decision_brief`) | DCI abstains on low vector scores, but prompt lacks explicit instructions for benchmark ungrounded questions. |
| **Benchmark Suite** | Automated Evaluation Runner | `NOT IMPLEMENTED` | N/A | Ground truth dataset exists, but no `eval_benchmark.py` script is present to compute accuracy stats. |
| **Deployment** | Docker Containerization | `NOT IMPLEMENTED` | N/A | Application runs directly on host OS without Docker compose configurations. |
