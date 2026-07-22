from bson import ObjectId
from datetime import datetime, timedelta

from app.db.mongodb import get_db
from app.services.embedding_service import get_embedding
from app.services.vector_store import search_similar_chunks
from app.services.llm_service import generate_decision_brief


def build_retrieved_chunk_citations(retrieved_chunks: list) -> list:
    """Attach immutable retrieval provenance instead of trusting LLM citations."""
    citations = []
    for chunk in retrieved_chunks:
        metadata = chunk.get("metadata", {})
        citations.append({
            "chunkId": chunk.get("chunkId"),
            "documentId": metadata.get("documentId"),
            "documentName": metadata.get("documentName"),
            "pageNumber": metadata.get("pageNumber"),
            "text": chunk.get("content", ""),
            "boundingBox": metadata.get("boundingBox"),
            "distance": chunk.get("distance"),
        })
    return citations

def generate_rag_decision_brief(asset_id_str: str, problem: str, engineer_id_str: str) -> dict:
    """
    Coordinates semantic manual searches, LLM grounded reasoning briefs,
    and runs the deterministic safety validations and confidence indexes (DCI).
    """
    db = get_db()
    asset_oid = ObjectId(asset_id_str)
    engineer_oid = ObjectId(engineer_id_str)

    asset = db.assets.find_one({"_id": asset_oid})
    if not asset:
        return {"success": False, "message": "Asset not found"}

    # 1. Fetch asset details and context from MongoDB
    facts = list(db.facts.find({"assetId": asset_oid}))
    procedures = list(db.procedures.find({"assetId": asset_oid}))
    executions = list(db.executionsessions.find({"assetId": asset_oid}))

    # 2. Execute vector database ChromaDB similarity search
    print(f"[DecisionIntel] Vectorizing problem symptom query: '{problem[:40]}...'")
    query_vector = get_embedding(problem)
    
    similar_chunks = search_similar_chunks(query_vector, asset_id=asset_id_str, limit=6)
    # Fallback to global search if no asset-specific chunks exist
    if not similar_chunks:
        print("[DecisionIntel] No asset-specific chunks found. Querying ChromaDB globally...")
        similar_chunks = search_similar_chunks(query_vector, asset_id=None, limit=6)

    # 3. Call Gemini Flash RAG generator for the analysis brief
    print("[DecisionIntel] Fetching active alerts for RAG context...")
    alerts = list(db.integrityalerts.find({"assetId": asset_oid, "status": "Active"}))
    
    print("[DecisionIntel] Synthesizing context-grounded decision brief...")
    ai_brief = generate_decision_brief(problem, asset["code"], similar_chunks, facts, alerts)
    retrieved_citations = build_retrieved_chunk_citations(similar_chunks)

    # 4. Calculate Deterministic DCI Score Components
    # A. Evidence Agreement (40% weight): Gemini confidence
    evidence_agreement = ai_brief.confidence or 0.8
    
    # B. Historical Success (20% weight): success rate of completed runs
    historical_success = 0.75
    completed_runs = [e for e in executions if e.get("status") == "Completed"]
    if completed_runs:
        successful_runs = [
            r for r in completed_runs 
            if r.get("outcome") and "fail" not in r["outcome"].lower() and "thinning" not in r["outcome"].lower()
        ]
        historical_success = len(successful_runs) / len(completed_runs)

    # C. Data Completeness (20% weight): coverage of Limits, Parts, Hazards in DB facts
    has_limits = any(f["type"] == "Limit" for f in facts)
    has_parts = any(f["type"] == "Part" for f in facts)
    has_hazards = any(f["type"] == "Hazard" for f in facts)
    
    data_completeness = (0.4 if has_limits else 0.0) + (0.3 if has_parts else 0.0) + (0.3 if has_hazards else 0.0)
    
    # Dynamic weights matching document dates and validation status
    doc_freshness = 1.0
    docs = list(db.documents.find({"assets": asset["code"]}))
    if docs:
        one_year_ago = datetime.utcnow() - timedelta(days=365)
        old_docs_count = sum(1 for d in docs if d.get("updatedAt", datetime.utcnow()) < one_year_ago)
        doc_freshness = max(0.2, 1.0 - (old_docs_count * 0.15))

    human_validation = 1.0
    if facts:
        validated_facts = [f for f in facts if f.get("status") == "Validated"]
        human_validation = len(validated_facts) / len(facts)

    # DCI = (Agreement * 0.4) + (Success * 0.2) + (Completeness * 0.2) + (Freshness * 0.1) + (Validation * 0.1)
    dci = (evidence_agreement * 0.4) + (historical_success * 0.2) + (data_completeness * 0.2) + (doc_freshness * 0.1) + (human_validation * 0.1)
    dci_percentage = round(dci * 100.0)
    
    print(f"[DecisionIntel] Final DCI calculated: {dci_percentage}%")

    # 5. ABSTENTION PROTOCOL: Refuse unsafe recommendations
    DCI_THRESHOLD = 50
    if dci_percentage < DCI_THRESHOLD:
        print(f"[DecisionIntel] WARNING: DCI below safety threshold ({dci_percentage}% < {DCI_THRESHOLD}%). ABSTAINING.")
        return {
            "success": False,
            "abstain": True,
            "message": "Unable to recommend due to insufficient validated evidence."
        }

    # 6. Parse and format procedure options from brief or fallback to DB list
    procedures_options = ai_brief.recommendedActions if ai_brief.recommendedActions else [p["name"] for p in procedures]
    if not procedures_options:
        procedures_options = ["General Mechanical Wear Ring Realignment Procedure"]

    # Construct standard camelCase response brief JSON
    brief_data = {
        "problemSummary": ai_brief.reasoningSummary or f"Diagnostic review for {asset['name']} ({asset['code']}).",
        "possibleCauses": ai_brief.possibleCauses,
        "procedureOptions": procedures_options,
        "supportingEvidence": retrieved_citations,
        "conflictingEvidence": [
            f"{a.get('description')} (Backend alert: {a.get('type')}, severity: {a.get('severity')})"
            for a in alerts
        ],
        "missingInformation": ai_brief.missingInformation,
        "decisionConfidenceIndex": dci_percentage,
        "riskLevel": ai_brief.riskLevel or "Medium",
        "estimatedRepairTime": "4 hours",
        "engineerApprovalRequired": dci_percentage < 80 or ai_brief.riskLevel in ["Critical", "High"]
    }

    # 7. Write Decision record to MongoDB
    decision_oid = ObjectId()
    db.decisions.insert_one({
        "_id": decision_oid,
        "assetId": asset_oid,
        "problem": problem,
        "brief": brief_data,
        "engineerId": engineer_oid,
        "status": "PENDING", # requires approval
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })

    # Update Asset scores
    db.assets.update_one(
        {"_id": asset_oid},
        {"$set": {
            "dciScore": dci_percentage,
            "updatedAt": datetime.utcnow()
        }}
    )

    decision_doc = db.decisions.find_one({"_id": decision_oid})
    decision_doc["id"] = str(decision_doc["_id"])
    del decision_doc["_id"]
    decision_doc["assetId"] = str(decision_doc["assetId"])
    decision_doc["engineerId"] = str(decision_doc["engineerId"])

    return {
        "success": True,
        "abstain": False,
        "decision": decision_doc
    }
