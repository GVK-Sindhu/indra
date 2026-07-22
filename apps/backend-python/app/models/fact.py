from typing import Optional, Dict
from datetime import datetime
from pydantic import Field
from app.models.base import CamelModel, PyObjectId

class Fact(CamelModel):
    """
    Pydantic schema representing the Fact model stored in MongoDB.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    type: str # Limit, Hazard, Warning, Part, Engineer, Asset
    value: str
    asset_id: PyObjectId
    document_id: PyObjectId
    page_number: int = 1
    bounding_box: Optional[Dict[str, float]] = None
    confidence: float = 0.95
    status: str = "Unvalidated" # Unvalidated, Validated, Contradictory, Deprecated
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
