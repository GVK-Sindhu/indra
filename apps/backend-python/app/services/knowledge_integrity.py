from bson import ObjectId
from datetime import datetime, timedelta

from app.db.mongodb import get_db

def validate_asset_integrity(asset_id_str: str) -> dict:
    """
    Executes a real-time KRI integrity scan on an asset.
    Evaluates manual freshness, contradictory limits, completeness of parameters, 
    and human approvals, writing the resulting KRI score directly to MongoDB.
    """
    db = get_db()
    asset_oid = ObjectId(asset_id_str)

    asset = db.assets.find_one({"_id": asset_oid})
    if not asset:
        return {"success": False, "message": "Asset not found"}

    # Fetch all facts and procedures linked to this asset
    facts = list(db.facts.find({"assetId": asset_oid}))
    procedures = list(db.procedures.find({"assetId": asset_oid}))
    
    # Fetch all alerts linked to this asset
    alerts = list(db.integrityalerts.find({"assetId": asset_oid, "status": "Active"}))

    # A. Freshness Score (30% weight)
    freshness_score = 1.0
    one_year_ago = datetime.utcnow() - timedelta(days=365)
    
    docs = list(db.documents.find({"assets": asset["code"]}))
    if docs:
        old_docs = [d for d in docs if d.get("updatedAt", datetime.utcnow()) < one_year_ago]
        if old_docs:
            freshness_score = max(0.2, 1.0 - (len(old_docs) * 0.15))
            
            # Automatically create an active OutdatedManual alert if not already exists
            dup = next((a for a in alerts if a["type"] == "OutdatedManual"), None)
            if not dup:
                db.integrityalerts.insert_one({
                    "assetId": asset_oid,
                    "type": "OutdatedManual",
                    "severity": "Medium",
                    "description": f"Documentation manual for {asset['code']} is outdated (exceeds 1 year limit).",
                    "details": {"outdatedDocumentsCount": len(old_docs)},
                    "status": "Active",
                    "createdAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                })

    # B. Consistency Score (30% weight)
    consistency_score = 1.0
    contradictory_facts = [f for f in facts if f.get("status") == "Contradictory"]
    if contradictory_facts:
        consistency_score = max(0.1, 1.0 - (len(contradictory_facts) * 0.10))

    # C. Completeness Score (20% weight)
    completeness_score = 0.5 # Base score
    has_limits = any(f["type"] == "Limit" for f in facts)
    has_parts = any(f["type"] == "Part" for f in facts)
    has_hazards = any(f["type"] == "Hazard" for f in facts)
    
    if has_limits:
        completeness_score += 0.20
    if has_parts:
        completeness_score += 0.15
    if has_hazards:
        completeness_score += 0.15

    # D. Human Approval Score (20% weight)
    approval_score = 1.0
    validated_facts = [f for f in facts if f.get("status") == "Validated"]
    if facts:
        approval_score = len(validated_facts) / len(facts)

    # Calculate final KRI score
    kri = (freshness_score * 0.3) + (consistency_score * 0.3) + (completeness_score * 0.2) + (approval_score * 0.2)
    kri_percentage = round(kri * 100.0)

    # 4. Check for missing inspections
    # If no procedures are registered for this asset, raise a MissingInspection warning alert
    if not procedures:
        dup = next((a for a in alerts if a["type"] == "MissingInspection"), None)
        if not dup:
            db.integrityalerts.insert_one({
                "assetId": asset_oid,
                "type": "MissingInspection",
                "severity": "High",
                "description": f"Safety warnings: Asset {asset['code']} lacks any registered SOP checklist procedures.",
                "details": {},
                "status": "Active",
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            })

    # Update Asset KRI score in MongoDB
    db.assets.update_one(
        {"_id": asset_oid},
        {"$set": {
            "kriScore": kri_percentage,
            "updatedAt": datetime.utcnow()
        }}
    )

    # Reload active alerts
    active_alerts = list(db.integrityalerts.find({"assetId": asset_oid, "status": "Active"}))
    for a in active_alerts:
        a["id"] = str(a["_id"])
        del a["_id"]
        a["assetId"] = str(a["assetId"])
        if a.get("resolvedBy"):
            a["resolvedBy"] = str(a["resolvedBy"])

    return {
        "success": True,
        "kriScore": kri_percentage,
        "dciScore": asset.get("dciScore", 100.0),
        "alerts": active_alerts,
        "metrics": {
            "freshness": round(freshness_score, 2),
            "consistency": round(consistency_score, 2),
            "completeness": round(completeness_score, 2),
            "validation": round(approval_score, 2)
        }
    }
