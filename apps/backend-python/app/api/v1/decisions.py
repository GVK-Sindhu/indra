from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime

from app.core.dependencies import get_current_user, RequireRole
from app.db.mongodb import get_db
from app.services.decision_intelligence import generate_rag_decision_brief

router = APIRouter(prefix="/decisions", tags=["Decision Intelligence"])

@router.post("/brief")
def create_decision_brief(body: dict, current_user: dict = Depends(get_current_user)):
    """
    Submits a symptom diagnostic query, executing vector search, Gemini reasoning,
    and returns the resulting Decision Brief, checking KRI/DCI safeties.
    """
    asset_id = body.get("assetId")
    problem = body.get("problem")

    if not asset_id or not problem:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fields 'assetId' and 'problem' are required."
        )

    try:
        ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid asset ID format.")

    result = generate_rag_decision_brief(
        asset_id_str=asset_id,
        problem=problem,
        engineer_id_str=current_user["id"]
    )
    
    if result.get("abstain"):
        return {
            "success": True,
            "data": {
                "abstain": True,
                "message": result.get("message", "Unable to recommend due to insufficient validated evidence.")
            }
        }

    return {
        "success": True,
        "data": {
            "abstain": False,
            "decision": result.get("decision")
        }
    }

@router.get("")
@router.get("/")
def list_decisions(current_user: dict = Depends(get_current_user)):
    """
    Lists all diagnostic decisions logged in the database.
    """
    db = get_db()
    decisions = list(db.decisions.find({}).sort("createdAt", -1))
    
    for d in decisions:
        d["id"] = str(d["_id"])
        del d["_id"]
        if d.get("assetId"):
            d["assetId"] = str(d["assetId"])
        if d.get("engineerId"):
            d["engineerId"] = str(d["engineerId"])
        if d.get("approvedBy"):
            d["approvedBy"] = str(d["approvedBy"])
        if isinstance(d.get("approvedAt"), datetime):
            d["approvedAt"] = d["approvedAt"].isoformat()
        if isinstance(d.get("createdAt"), datetime):
            d["createdAt"] = d["createdAt"].isoformat()
        if isinstance(d.get("updatedAt"), datetime):
            d["updatedAt"] = d["updatedAt"].isoformat()
            
    return {
        "success": True,
        "data": {
            "decisions": decisions
        }
    }

@router.post("/{decision_id}/approve")
def approve_decision(
    decision_id: str,
    body: dict = {},
    current_user: dict = Depends(RequireRole(["MANAGER", "ADMIN"]))
):
    """
    Approves a PENDING decision. Restricts access to MANAGER or ADMIN.
    """
    db = get_db()
    try:
        dec_oid = ObjectId(decision_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid decision ID format.")

    decision = db.decisions.find_one({"_id": dec_oid})
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found.")

    if decision.get("status") != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve a decision in state: {decision.get('status')}"
        )

    feedback = body.get("feedback", "")
    
    db.decisions.update_one(
        {"_id": dec_oid},
        {"$set": {
            "status": "APPROVED",
            "approvedBy": ObjectId(current_user["id"]),
            "approvedAt": datetime.utcnow(),
            "feedback": feedback,
            "updatedAt": datetime.utcnow()
        }}
    )

    updated_doc = db.decisions.find_one({"_id": dec_oid})
    updated_doc["id"] = str(updated_doc["_id"])
    del updated_doc["_id"]
    updated_doc["assetId"] = str(updated_doc["assetId"])
    updated_doc["engineerId"] = str(updated_doc["engineerId"])
    updated_doc["approvedBy"] = str(updated_doc["approvedBy"])
    updated_doc["approvedAt"] = updated_doc["approvedAt"].isoformat()

    return {
        "success": True,
        "data": {
            "decision": updated_doc
        }
    }

@router.post("/{decision_id}/reject")
def reject_decision(
    decision_id: str,
    body: dict = {},
    current_user: dict = Depends(RequireRole(["MANAGER", "ADMIN"]))
):
    """
    Rejects a PENDING decision. Restricts access to MANAGER or ADMIN.
    """
    db = get_db()
    try:
        dec_oid = ObjectId(decision_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid decision ID format.")

    decision = db.decisions.find_one({"_id": dec_oid})
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found.")

    if decision.get("status") != "PENDING":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject a decision in state: {decision.get('status')}"
        )

    feedback = body.get("feedback", "")

    db.decisions.update_one(
        {"_id": dec_oid},
        {"$set": {
            "status": "REJECTED",
            "approvedBy": ObjectId(current_user["id"]),
            "approvedAt": datetime.utcnow(),
            "feedback": feedback,
            "updatedAt": datetime.utcnow()
        }}
    )

    updated_doc = db.decisions.find_one({"_id": dec_oid})
    updated_doc["id"] = str(updated_doc["_id"])
    del updated_doc["_id"]
    updated_doc["assetId"] = str(updated_doc["assetId"])
    updated_doc["engineerId"] = str(updated_doc["engineerId"])
    updated_doc["approvedBy"] = str(updated_doc["approvedBy"])
    updated_doc["approvedAt"] = updated_doc["approvedAt"].isoformat()

    return {
        "success": True,
        "data": {
            "decision": updated_doc
        }
    }

