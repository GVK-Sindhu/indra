from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import Field
from app.models.base import CamelModel, PyObjectId

class DocumentVersion(CamelModel):
    version_number: int
    file_name: str
    file_path: str
    uploaded_by: PyObjectId
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class Document(CamelModel):
    """
    Pydantic schema representing the Document model stored in MongoDB.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    title: str
    description: str
    type: str # 'SOP', 'Manual', 'General'
    assets: List[str] = Field(default=[]) # List of asset codes, e.g. ["PUMP-102"]
    versions: List[DocumentVersion] = Field(default=[])
    tags: List[str] = Field(default=[])
    processing_status: str = "PENDING" # PENDING, PROCESSING, COMPLETED, FAILED
    processing_error: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class DocumentChunk(CamelModel):
    """
    Pydantic schema representing the DocumentChunk model stored in MongoDB.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    document_id: PyObjectId
    version_number: int
    page_number: int
    content: str
    bounding_box: Dict[str, float] = Field(default={"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0})
    confidence: float = 1.0
    classification: str = "OCR_Parsed"
    created_at: Optional[datetime] = None
