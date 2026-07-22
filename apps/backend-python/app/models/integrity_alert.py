from typing import Optional, Any, Dict
from datetime import datetime
from pydantic import Field
from app.models.base import CamelModel, PyObjectId

class IntegrityAlert(CamelModel):
    """
    Pydantic schema representing the IntegrityAlert model stored in MongoDB.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    asset_id: PyObjectId
    type: str # Contradiction, OutdatedManual, MissingInspection
    severity: str # Low, Medium, High, Critical
    description: str
    details: Dict[str, Any] = Field(default={})
    status: str = "Active" # Active, Acknowledged, Resolved
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[PyObjectId] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
