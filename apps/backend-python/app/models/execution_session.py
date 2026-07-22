from typing import Optional, List
from datetime import datetime
from pydantic import Field
from app.models.base import CamelModel, PyObjectId

class StepExecutionState(CamelModel):
    step_number: int
    completed: bool = False
    completed_at: Optional[datetime] = None
    measurement_name: Optional[str] = None
    measurement_value: Optional[float] = None
    notes: Optional[str] = None
    image: Optional[str] = None

class ExecutionSession(CamelModel):
    """
    Pydantic schema representing the ExecutionSession model stored in MongoDB.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    procedure_id: PyObjectId
    asset_id: PyObjectId
    engineer_id: PyObjectId
    status: str = "Active" # Active, Completed, Failed
    steps: List[StepExecutionState] = Field(default=[])
    warnings_raised: List[str] = Field(default=[])
    outcome: Optional[str] = None
    feedback: Optional[str] = None
    lessons_learned: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
