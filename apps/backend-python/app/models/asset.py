from typing import Optional
from datetime import datetime
from pydantic import Field
from app.models.base import CamelModel, PyObjectId

class Asset(CamelModel):
    """
    Pydantic schema representing the Asset model stored in MongoDB.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    code: str # Unique identifier (e.g. 'PUMP-102')
    type: str # e.g. 'Pump', 'Boiler'
    description: str
    kri_score: float = 100.0
    dci_score: float = 100.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
