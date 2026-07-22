from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from app.core.dependencies import get_current_user
from app.services.analytics_service import compile_dashboard_analytics, compile_asset_profile

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/dashboard")
def get_dashboard_data(current_user: dict = Depends(get_current_user)):
    """
    Exposes aggregate global operational metrics and incident lists.
    """
    data = compile_dashboard_analytics()
    success = True
    if "success" in data:
        success = data.pop("success")
    return {
        "success": success,
        "data": data
    }

@router.get("/assets/{asset_id}")
def get_asset_profile(asset_id: str, current_user: dict = Depends(get_current_user)):
    """
    Exposes complete profile containing active KRI and checklists status for a single asset.
    """
    try:
        ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid asset ID format.")

    result = compile_asset_profile(asset_id)
    if not result.get("success", True):
        raise HTTPException(status_code=404, detail=result.get("message", "Asset not found."))
        
    success = True
    if "success" in result:
        success = result.pop("success")
        
    return {
        "success": success,
        "data": result
    }

