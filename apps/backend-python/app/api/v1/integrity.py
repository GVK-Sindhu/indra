from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from app.core.dependencies import get_current_user
from app.db.mongodb import get_db
from app.services.knowledge_integrity import validate_asset_integrity

router = APIRouter(prefix="/integrity", tags=["Knowledge Integrity"])

@router.get("/facts")
def list_facts(current_user: dict = Depends(get_current_user)):
    """
    Exposes full listing of compiled parameter facts, safety limits, and parts mappings.
    """
    db = get_db()
    facts = list(db.facts.find({}))
    
    for f in facts:
        f["id"] = str(f["_id"])
        del f["_id"]
        f["assetId"] = str(f["assetId"])
        f["documentId"] = str(f["documentId"])
        
    return {
        "success": True,
        "data": {
            "facts": facts
        }
    }

@router.get("/assets")
def list_assets_integrity(current_user: dict = Depends(get_current_user)):
    """
    Compiles global list of assets alongside their active KRI reliability metrics.
    """
    db = get_db()
    assets = list(db.assets.find({}))
    
    compiled_assets = []
    for a in assets:
        asset_id_str = str(a["_id"])
        # Find active warnings count for this asset
        alerts_count = db.integrityalerts.count_documents({"assetId": a["_id"], "status": "Active"})
        
        compiled_assets.append({
            "id": asset_id_str,
            "name": a["name"],
            "code": a["code"],
            "type": a["type"],
            "description": a["description"],
            "kriScore": a.get("kriScore", 100),
            "dciScore": a.get("dciScore", 100),
            "warningsCount": alerts_count
        })
        
    return {
        "success": True,
        "data": {
            "assets": compiled_assets
        }
    }

@router.get("/alerts")
def list_alerts(current_user: dict = Depends(get_current_user)):
    """
    Lists open warning alerts compiled across the asset fleet.
    """
    db = get_db()
    alerts = list(db.integrityalerts.find({"status": "Active"}))
    
    for a in alerts:
        a["id"] = str(a["_id"])
        del a["_id"]
        a["assetId"] = str(a["assetId"])
        if a.get("resolvedBy"):
            a["resolvedBy"] = str(a["resolvedBy"])
            
    return {
        "success": True,
        "data": {
            "alerts": alerts
        }
    }

@router.get("/{asset_id}")
def execute_integrity_scan(asset_id: str, current_user: dict = Depends(get_current_user)):
    """
    Triggers an on-demand active KRI metrics validation scan.
    """
    try:
        ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid asset ID format.")

    result = validate_asset_integrity(asset_id)
    if not result.get("success", True):
        raise HTTPException(status_code=500, detail=result.get("message", "Validation failed."))
        
    return {
        "success": True,
        "data": {
            "assetId": asset_id,
            "kriScore": result.get("kriScore"),
            "dciScore": result.get("dciScore"),
            "alerts": result.get("alerts", []),
            "metrics": result.get("metrics")
        }
    }

