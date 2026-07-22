from typing import Optional
from datetime import datetime
from pydantic import Field
from app.models.base import CamelModel, PyObjectId

class Relation(CamelModel):
    """
    Pydantic schema representing the Relation model stored in MongoDB.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    source_id: PyObjectId
    source_type: str # Fact, Document, Asset
    target_id: PyObjectId
    target_type: str # Fact, Document, Asset
    type: str # contradicts, validates, references
    confidence: float = 0.95
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
