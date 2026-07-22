from typing import Optional, List
from datetime import datetime
from pydantic import Field
from app.models.base import CamelModel, PyObjectId

class DecisionBrief(CamelModel):
    problem_summary: str
    possible_causes: List[str] = Field(default=[])
    procedure_options: List[str] = Field(default=[])
    supporting_evidence: List[dict] = Field(default=[])
    conflicting_evidence: List[str] = Field(default=[])
    missing_information: List[str] = Field(default=[])
    decision_confidence_index: float
    risk_level: str # Low, Medium, High, Critical
    estimated_repair_time: str = "4 hours"
    engineer_approval_required: bool = True

class Decision(CamelModel):
    """
    Pydantic schema representing the Decision model stored in MongoDB.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    asset_id: PyObjectId
    problem: str
    brief: DecisionBrief
    engineer_id: PyObjectId
    status: str = "PENDING" # PENDING, APPROVED, REJECTED
    approved_by: Optional[PyObjectId] = None
    approved_at: Optional[datetime] = None
    feedback: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
