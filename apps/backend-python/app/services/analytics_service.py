from bson import ObjectId
from datetime import datetime

from app.db.mongodb import get_db

def compile_dashboard_analytics() -> dict:
    """
    Executes database aggregation pipelines to compile the global statistics,
    KRI heatmap, recent decision briefs, and active alerts shown on dashboards.
    """
    db = get_db()

    # 1. Total counts
    total_assets = db.assets.count_documents({})
    active_alerts_count = db.integrityalerts.count_documents({"status": "Active"})
    decisions_pending_count = db.decisions.count_documents({"status": "PENDING"})

    # 2. Average KRI Score
    kri_avg = 100.0
    assets = list(db.assets.find({}))
    if assets:
        kri_sum = sum(a.get("kriScore", 100.0) for a in assets)
        kri_avg = round(kri_sum / len(assets))

    # 3. KRI Heatmap Data
    heatmap_data = []
    for a in assets:
        alerts_cnt = db.integrityalerts.count_documents({"assetId": a["_id"], "status": "Active"})
        heatmap_data.append({
            "id": str(a["_id"]),
            "assetId": str(a["_id"]),
            "name": a["name"],
            "code": a["code"],
            "type": a["type"],
            "kriScore": a.get("kriScore", 100),
            "dciScore": a.get("dciScore", 100),
            "warningsCount": alerts_cnt,
            "severity": "Optimal" if a.get("kriScore", 100) >= 75 else "Moderate" if a.get("kriScore", 100) >= 45 else "Critical"
        })

    # Stats variables matching frontend stats definition
    high_risk_count = db.assets.count_documents({"kriScore": {"$lt": 70}})
    pending_inspections = db.integrityalerts.count_documents({"type": "MissingInspection", "status": "Active"})
    contradictions_count = db.integrityalerts.count_documents({"type": "Contradiction", "status": "Active"})
    recurring_failures = db.executionsessions.count_documents({"status": "Failed"})
    total_sessions = db.executionsessions.count_documents({"status": "Completed"})
    
    # Success rate
    completed_runs_count = db.executionsessions.count_documents({"status": "Completed"})
    failed_runs_count = db.executionsessions.count_documents({"status": "Failed"})
    total_runs = completed_runs_count + failed_runs_count
    success_rate = 100
    if total_runs > 0:
        success_rate = round((completed_runs_count / total_runs) * 100)
        
    # Avg duration
    completed_sessions = list(db.executionsessions.find({"status": "Completed", "completedAt": {"$ne": None}, "createdAt": {"$ne": None}}))
    avg_duration = 45 # Default to 45 mins
    if completed_sessions:
        durations = []
        for s in completed_sessions:
            try:
                c_at = s["completedAt"]
                cr_at = s["createdAt"]
                if isinstance(c_at, str):
                    c_at = datetime.fromisoformat(c_at.replace("Z", "+00:00"))
                if isinstance(cr_at, str):
                    cr_at = datetime.fromisoformat(cr_at.replace("Z", "+00:00"))
                diff = c_at - cr_at
                durations.append(diff.total_seconds() / 60.0)
            except Exception:
                pass
        if durations:
            avg_duration = round(sum(durations) / len(durations))

    stats_payload = {
        "averageKri": kri_avg,
        "highRiskAssetsCount": high_risk_count,
        "pendingInspections": pending_inspections,
        "contradictionsCount": contradictions_count,
        "recurringFailures": recurring_failures,
        "totalMaintenanceSessions": total_sessions,
        "maintenanceSuccessRate": success_rate,
        "avgDurationMinutes": avg_duration
    }

    # 4. Recent Decisions resolved with assetCode, topic, dci, and date
    recent_decisions_raw = list(db.decisions.find({}).sort("createdAt", -1).limit(5))
    recent_decisions = []
    for d in recent_decisions_raw:
        asset_doc = db.assets.find_one({"_id": d.get("assetId")})
        asset_code = asset_doc.get("code", "UNKNOWN") if asset_doc else "UNKNOWN"
        recent_decisions.append({
            "id": str(d["_id"]),
            "topic": d.get("problem", ""),
            "assetCode": asset_code,
            "dci": d.get("brief", {}).get("decisionConfidenceIndex", 100) if d.get("brief") else 100,
            "status": d.get("status", "PENDING"),
            "date": d.get("createdAt", datetime.utcnow()).strftime("%Y-%m-%d") if isinstance(d.get("createdAt"), datetime) else str(d.get("createdAt"))[:10]
        })

    # 5. Open Alerts resolved with assetCode
    open_alerts_raw = list(db.integrityalerts.find({"status": "Active"}).sort("createdAt", -1).limit(6))
    open_alerts = []
    for a in open_alerts_raw:
        asset_doc = db.assets.find_one({"_id": a.get("assetId")})
        asset_code = asset_doc.get("code", "UNKNOWN") if asset_doc else "UNKNOWN"
        open_alerts.append({
            "id": str(a["_id"]),
            "assetCode": asset_code,
            "type": a.get("type"),
            "severity": a.get("severity"),
            "description": a.get("description"),
            "status": a.get("status"),
            "createdAt": a.get("createdAt", datetime.utcnow()).isoformat() if isinstance(a.get("createdAt"), datetime) else str(a.get("createdAt"))
        })

    # 6. Knowledge Trend
    total_docs = db.documents.count_documents({})
    total_facts = db.facts.count_documents({})
    knowledge_trend = {
        "totalDocuments": total_docs,
        "totalFacts": total_facts
    }

    return {
        "success": True,
        "stats": stats_payload,
        "heatmap": heatmap_data,
        "decisions": recent_decisions,
        "alerts": open_alerts,
        "knowledgeTrend": knowledge_trend
    }

def compile_asset_profile(asset_id_str: str) -> dict:
    """
    Compiles a complete asset profile matching frontend expectations to prevent page load crashes.
    """
    db = get_db()
    asset_oid = ObjectId(asset_id_str)

    asset = db.assets.find_one({"_id": asset_oid})
    if not asset:
        return {"success": False, "message": "Asset not found"}

    # Fetch facts
    facts = list(db.facts.find({"assetId": asset_oid}))
    facts_serialized = []
    for f in facts:
        fact_data = {
            "id": str(f["_id"]),
            "type": f.get("type", "Asset"),
            "value": f.get("value", ""),
            "assetId": str(f["assetId"]),
            "documentId": str(f["documentId"]),
            "pageNumber": f.get("pageNumber", 1),
            "confidence": f.get("confidence", 0.95),
            "status": f.get("status", "Validated"),
            "timestamp": f.get("createdAt", datetime.utcnow()).isoformat() if isinstance(f.get("createdAt"), datetime) else str(f.get("createdAt"))
        }
        if f.get("boundingBox"):
            fact_data["boundingBox"] = f["boundingBox"]
        facts_serialized.append(fact_data)

    # Fetch alerts
    alerts = list(db.integrityalerts.find({"assetId": asset_oid, "status": "Active"}))
    alerts_serialized = []
    for a in alerts:
        alerts_serialized.append({
            "id": str(a["_id"]),
            "type": a.get("type"),
            "severity": a.get("severity"),
            "description": a.get("description"),
            "status": a.get("status")
        })

    # Fetch procedures (mapped to ProcedureLink format)
    procedures = list(db.procedures.find({"assetId": asset_oid}))
    procedures_serialized = []
    for p in procedures:
        procedures_serialized.append({
            "id": str(p["_id"]),
            "name": p.get("name", ""),
            "stepsCount": len(p.get("steps", []))
        })

    # Fetch executions (history sessions)
    executions = list(db.executionsessions.find({"assetId": asset_oid}).sort("createdAt", -1).limit(10))
    executions_serialized = []
    for e in executions:
        executions_serialized.append({
            "id": str(e["_id"]),
            "procedureId": str(e["procedureId"]),
            "assetId": str(e["assetId"]),
            "engineerId": str(e["engineerId"]),
            "status": e.get("status"),
            "completedAt": e.get("completedAt").isoformat() if isinstance(e.get("completedAt"), datetime) else str(e.get("completedAt")) if e.get("completedAt") else None,
            "createdAt": e.get("createdAt").isoformat() if isinstance(e.get("createdAt"), datetime) else str(e.get("createdAt"))
        })

    # Fetch decisions (mapped to DecisionHistory format)
    decisions = list(db.decisions.find({"assetId": asset_oid}).sort("createdAt", -1).limit(10))
    decisions_serialized = []
    for d in decisions:
        decisions_serialized.append({
            "id": str(d["_id"]),
            "problem": d.get("problem", ""),
            "dci": d.get("brief", {}).get("decisionConfidenceIndex", 100) if d.get("brief") else 100,
            "status": d.get("status", "PENDING"),
            "date": d.get("createdAt", datetime.utcnow()).strftime("%Y-%m-%d") if isinstance(d.get("createdAt"), datetime) else str(d.get("createdAt"))[:10]
        })

    # Fetch documents linked to this asset code
    docs = list(db.documents.find({"assets": asset["code"]}))
    documents_serialized = []
    for doc in docs:
        versions = doc.get("versions", [])
        v_num = versions[-1].get("versionNumber", 1) if versions else 1
        documents_serialized.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "type": doc.get("type", "PDF"),
            "status": doc.get("processingStatus", "COMPLETED"),
            "version": v_num
        })

    # Incidents derived from warning/hazard facts
    hazards = [f for f in facts if f.get("type") in ["Hazard", "Warning"]]
    incidents_serialized = []
    for h in hazards:
        incidents_serialized.append({
            "description": h.get("value", ""),
            "pageNumber": h.get("pageNumber", 1),
            "confidence": h.get("confidence", 0.95),
            "timestamp": h.get("createdAt", datetime.utcnow()).isoformat() if isinstance(h.get("createdAt"), datetime) else str(h.get("createdAt"))
        })

    # Lessons learned derived from completed execution logs
    lessons_serialized = []
    for e in executions:
        if e.get("status") == "Completed" and e.get("lessonsLearned"):
            p_oid = e["procedureId"]
            if isinstance(p_oid, str):
                try:
                    p_oid = ObjectId(p_oid)
                except Exception:
                    pass
            p_doc = db.procedures.find_one({"_id": p_oid})
            p_name = p_doc.get("name", "Unknown SOP") if p_doc else "Unknown SOP"
            lessons_serialized.append({
                "procedureName": p_name,
                "lesson": e.get("lessonsLearned"),
                "feedback": e.get("feedback"),
                "date": e.get("completedAt").isoformat() if isinstance(e.get("completedAt"), datetime) else str(e.get("completedAt")) if e.get("completedAt") else None
            })

    return {
        "success": True,
        "asset": {
            "id": str(asset["_id"]),
            "name": asset.get("name"),
            "code": asset.get("code"),
            "type": asset.get("type"),
            "description": asset.get("description"),
            "kriScore": asset.get("kriScore", 100),
            "dciScore": asset.get("dciScore", 100)
        },
        "alertsCount": len(alerts_serialized),
        "alerts": alerts_serialized,
        "decisions": decisions_serialized,
        "procedures": procedures_serialized,
        "documents": documents_serialized,
        "incidents": incidents_serialized,
        "lessonsLearned": lessons_serialized
    }
