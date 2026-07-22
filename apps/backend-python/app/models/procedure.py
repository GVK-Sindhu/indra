from typing import Optional, List
from datetime import datetime
from pydantic import Field
from app.models.base import CamelModel, PyObjectId

class StepMeasurementLimit(CamelModel):
    name: str
    unit: str
    min_limit: Optional[float] = None
    max_limit: Optional[float] = None

class StepDocReference(CamelModel):
    document_id: PyObjectId
    page_number: int

class ProcedureStep(CamelModel):
    step_number: int
    instruction: str
    validation_type: str # None, Measurement, Visual, Approval
    measurements: List[StepMeasurementLimit] = Field(default=[])
    safety_note: Optional[str] = None
    warning: Optional[str] = None
    doc_references: List[StepDocReference] = Field(default=[])

class Procedure(CamelModel):
    """
    Pydantic schema representing the Procedure model stored in MongoDB.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    name: str
    description: str
    asset_id: PyObjectId
    steps: List[ProcedureStep] = Field(default=[])
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
