from pydantic import BaseModel, Field
from typing import List, Optional
from google import genai
from google.genai import types
import json
import sys

from app.services.embedding_service import get_genai_client

# ==========================================
# PYDANTIC SCHEMAS FOR STRUCTURED EXTRACTION
# ==========================================

class ExtractedFact(BaseModel):
    type: str = Field(description="Must be one of: 'Limit', 'Hazard', 'Warning', 'Part', 'Engineer', 'Asset'")
    parameter: Optional[str] = Field(default=None, description="The normalized name of the parameter if applicable (e.g. 'maximum operating pressure').")
    numericValue: Optional[float] = Field(default=None, description="The normalized numeric value of the parameter if applicable.")
    unit: Optional[str] = Field(default=None, description="The unit of measurement if applicable (e.g., 'bar', 'RPM', 'C').")
    value: str = Field(description="The factual sentence containing the parameter, threshold, hazard instruction, or spare part detail.")
    pageNumber: int = Field(description="The 1-based page number where this fact was found.")
    confidence: float = Field(description="Confidence score from 0.0 to 1.0.")

class ExtractedContradiction(BaseModel):
    factValueA: str = Field(description="Value of the first conflicting limit/instruction.")
    factValueB: str = Field(description="Value of the second conflicting limit/instruction.")
    severity: str = Field(description="Severity of the contradiction: 'Low', 'Medium', 'High', 'Critical'")
    description: str = Field(description="Explanation of why these two facts contradict each other logically (e.g. pressure thresholds overlap).")

class ExtractedStepMeasurement(BaseModel):
    name: str = Field(description="Name of the measurement parameter (e.g. 'Impeller Clearance', 'Casing Gauge Pressure').")
    unit: str = Field(description="Unit of measurement (e.g. 'mm', 'bar', 'RPM', 'C').")
    minLimit: Optional[float] = Field(description="Minimum safety limit value if specified, else null.")
    maxLimit: Optional[float] = Field(description="Maximum safety limit value if specified, else null.")

class ExtractedProcedureStep(BaseModel):
    stepNumber: int = Field(description="The sequential step number in the SOP checklist (1-based).")
    instruction: str = Field(description="The instruction text describing what the technician needs to perform.")
    validationType: str = Field(description="The verification category. Must be one of: 'None', 'Measurement', 'Visual', 'Approval'. Choose 'Measurement' if a numeric parameter check is required.")
    measurements: Optional[List[ExtractedStepMeasurement]] = Field(default=None, description="Detailed limits definitions if validationType is 'Measurement'.")
    safetyNote: Optional[str] = Field(default=None, description="Any safety notes associated with this step.")
    warning: Optional[str] = Field(default=None, description="Any high-risk warnings or burn/shock hazards associated with this step.")
    pageNumber: int = Field(description="The 1-based page number where this step instruction was extracted.")

class ExtractedProcedure(BaseModel):
    name: str = Field(description="The formal title of the checklist procedure (e.g. 'PUMP-102 Impeller Clearance SOP').")
    description: str = Field(description="A brief description of when this procedure is executed.")
    steps: List[ExtractedProcedureStep] = Field(description="Checklist steps in strict sequential order.")

class DocumentIngestionExtraction(BaseModel):
    facts: List[ExtractedFact] = Field(default=[])
    contradictions: List[ExtractedContradiction] = Field(default=[])
    procedures: List[ExtractedProcedure] = Field(default=[])

# ==========================================
# PYDANTIC SCHEMAS FOR DECISION INTEL BRIEF
# ==========================================

class RAGDecisionBrief(BaseModel):
    possibleCauses: List[str] = Field(description="List of possible causes of the reported problem grounded strictly in document evidence.")
    recommendedActions: List[str] = Field(description="List of step-by-step procedures/checklists to run based on the reference manual.")
    safetyLimits: List[str] = Field(description="Directly quoted safety thresholds, MAWPs, speed limits, or temperatures associated with the asset.")
    missingInformation: List[str] = Field(description="Gaps in the current telemetry context that the engineer should verify (e.g. missing oil reports).")
    riskLevel: str = Field(description="Risk level. Must be one of: 'Low', 'Medium', 'High', 'Critical'")
    reasoningSummary: str = Field(description="A synthesis summarizing why the causes are likely, citing the documentation logically.")
    confidence: float = Field(description="AI's confidence score from 0.0 to 1.0.")

# ==========================================
# LLM SERVICE IMPLEMENTATIONS
# ==========================================

def extract_document_intelligence(document_text: str, document_name: str, existing_facts_context: str = "") -> DocumentIngestionExtraction:
    """
    Calls Gemini 2.5 Flash to parse facts, contradictions, and checklists from raw document texts.
    Enforces a strict Pydantic output schema. Can compare against existing facts context.
    """
    client = get_genai_client()
    
    prompt = f"""
    You are an industrial document analysis agent. Analyze the following document text from '{document_name}'.
    
    Perform the following tasks:
    1. Extract all factual statements about operating limits, safety warnings, hazards, parts numbers, or engineers mentioned.
       - IMPORTANT: For 'Limit' types, you MUST populate the 'parameter', 'numericValue', and 'unit' fields with normalized values (e.g. parameter="maximum operating pressure", numericValue=10.0, unit="bar") to enable programmatic contradiction detection.
    2. Identify any logical contradictions within this document text, and also between this text and the existing facts in the database listed in the context below (e.g. one source saying MAWP is 45 bar, and another claiming 47 bar).
    3. Compile any step-by-step checklists or Standard Operating Procedures (SOPs) into structured sequential steps, mapping validation types and numeric limits.
    
    Ensure all extracted page references match the page markings in the text (or fallback to the provided content's page structures).
    Do not invent facts. Return only items present in the source text or contradictions against the existing facts database context.
    
    CRITICAL REQUIREMENT FOR CONTRADICTIONS:
    - If you find a contradiction, one fact Value must come from the new document text, and the other must come from either the document text or the existing facts database context.
    - You MUST copy the exact string of the facts for factValueA and factValueB without changing any character, punctuation, or capitalization. This is crucial for database lookup of the facts.
    """
    
    if existing_facts_context:
        prompt += f"""
    {existing_facts_context}
    """
        
    prompt += f"""
    New Document Source Text to Analyze:
    {document_text}
    """

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DocumentIngestionExtraction,
                temperature=0.1
            )
        )
        data = json.loads(response.text)
        return DocumentIngestionExtraction(**data)
    except Exception as e:
        print(f"[LLMService] Document extraction failed: {str(e)}", file=sys.stderr)
        return DocumentIngestionExtraction()

def generate_decision_brief(problem: str, asset_code: str, retrieved_chunks: list, facts: list = None, alerts: list = None) -> RAGDecisionBrief:
    """
    Executes context-grounded RAG reasoning over retrieved Chroma chunks and structured DB facts/alerts.
    Constructs a grounded brief and flags missing information.
    """
    client = get_genai_client()
    
    context_str = ""
    for idx, chunk in enumerate(retrieved_chunks):
        doc_name = chunk["metadata"].get("documentName", "Manual")
        pg_num = chunk["metadata"].get("pageNumber", 0)
        context_str += f"[Chunk {idx+1}] Source: {doc_name} (Page {pg_num})\nContent: {chunk['content']}\n\n"

    structured_context = ""
    if facts:
        structured_context += "--- STRUCTURED FACTS FROM ASSET DATABASE ---\n"
        for f in facts:
            status_str = f" [Status: {f.get('status')}]" if f.get("status") != "Validated" else ""
            structured_context += f"- {f.get('type')}: {f.get('value')}{status_str}\n"
        structured_context += "\n"
        
    if alerts:
        structured_context += "--- ACTIVE COMPLIANCE & INTEGRITY ALERTS ---\n"
        for a in alerts:
            structured_context += f"- Alert [{a.get('type')} - Severity: {a.get('severity')}]: {a.get('description')}\n"
        structured_context += "\n"

    prompt = f"""
    You are an expert industrial safety and decision intelligence assistant.
    You are analyzing a reported problem symptom on the asset '{asset_code}'.
    
    Reported Problem: "{problem}"
    
    Use BOTH the retrieved document chunks and structured asset database context below. Do not use external training data or assume limits not documented.
    
    {structured_context}
    
    Retrieved Document Context:
    {context_str}
    
    Formulate a Decision Brief detailing:
    1. Possible causes of the problem.
    2. Recommended checklist actions (SOP procedures options).
    3. Conflicting evidence or safety concerns, described in prose only.
    5. Safety limits and warning thresholds (MAWP, RPM thresholds, lockouts) associated with this asset.
    6. Missing Information: What details are missing from the retrieved context that would be critical for a safe final repair (e.g., oil analysis, zero energy lockout verification)?
    7. Overall risk level of the operation (Low, Medium, High, Critical).
    8. A clean reasoning summary explaining the logic.
    
    If there is insufficient evidence in the context to explain the problem, explicitly state so in the missingInformation or possibleCauses fields and return a low confidence score. Do not make up answers.
    Do not generate citation fields, source document names, page numbers, chunk identifiers, or relevance scores. The backend attaches source provenance directly from retrieved chunks.
    """

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RAGDecisionBrief,
                temperature=0.2
            )
        )
        data = json.loads(response.text)
        return RAGDecisionBrief(**data)
    except Exception as e:
        print(f"[LLMService] RAG brief generation failed: {str(e)}", file=sys.stderr)
        raise e
