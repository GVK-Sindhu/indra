"""
INDRA Agentic AI & FastMCP API Routes
Provides endpoints to trigger autonomous agent workflows,
inspect FastMCP tool schemas, and invoke MCP tools over REST.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

from app.services.agent_orchestrator import agent_orchestrator
from app.mcp.server import (
    get_asset_reliability,
    query_industrial_specifications,
    evaluate_decision_guardrails,
    detect_sop_contradictions,
    validate_sop_measurement
)

router = APIRouter(prefix="/agent", tags=["Agentic AI & FastMCP"])

class AgentOrchestrateRequest(BaseModel):
    assetCode: str = Field(default="PUMP-102", description="Target industrial asset code")
    anomaly: str = Field(..., description="Operational problem or anomaly description to investigate")

class ToolCallRequest(BaseModel):
    tool: str = Field(..., description="Name of the FastMCP tool to invoke")
    parameters: Dict[str, Any] = Field(default_factory=dict, description="Parameters to pass to the tool")

@router.get("/tools")
def get_mcp_tools():
    """
    Returns the FastMCP Tool Registry schemas adhering to Model Context Protocol standards.
    """
    return {
        "success": True,
        "protocol": "Model Context Protocol (FastMCP)",
        "server": "INDRA-Industrial-Reliability-MCP",
        "tools": [
            {
                "name": "get_asset_reliability",
                "description": "Calculates Knowledge Reliability Index (KRI) and flags contradiction alerts for an asset.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "asset_code": {"type": "string", "description": "Asset identifier (e.g. PUMP-102, BOILER-04)"}
                    },
                    "required": ["asset_code"]
                }
            },
            {
                "name": "query_industrial_specifications",
                "description": "ChromaDB semantic search against technical manuals and SOPs with bounding box provenance.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "asset_code": {"type": "string", "description": "Asset identifier"},
                        "query": {"type": "string", "description": "Technical search query"}
                    },
                    "required": ["asset_code", "query"]
                }
            },
            {
                "name": "evaluate_decision_guardrails",
                "description": "Calculates Decision Confidence Index (DCI) and enforces Safety Abstention if DCI < 50%.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "asset_code": {"type": "string", "description": "Asset identifier"},
                        "problem_statement": {"type": "string", "description": "Diagnostic anomaly description"}
                    },
                    "required": ["asset_code", "problem_statement"]
                }
            },
            {
                "name": "detect_sop_contradictions",
                "description": "Cross-references SOP revisions to detect conflicting operational limits.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "asset_code": {"type": "string", "description": "Asset identifier"}
                    },
                    "required": ["asset_code"]
                }
            },
            {
                "name": "validate_sop_measurement",
                "description": "Validates real-time field engineer measurement against safe operating tolerance bounds.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "asset_code": {"type": "string", "description": "Asset identifier"},
                        "parameter_name": {"type": "string", "description": "Measurement name"},
                        "measured_value": {"type": "number", "description": "Observed value"}
                    },
                    "required": ["asset_code", "parameter_name", "measured_value"]
                }
            }
        ]
    }

@router.post("/orchestrate")
def orchestrate_agent(request: AgentOrchestrateRequest):
    """
    Executes the autonomous Multi-Agent loop using FastMCP tools.
    Returns step-by-step agent thoughts, tool calls, and final decision packet.
    """
    result = agent_orchestrator.run_agentic_workflow(
        anomaly_description=request.anomaly,
        asset_code=request.assetCode
    )
    return {
        "success": True,
        "data": result
    }

@router.post("/tool/call")
def invoke_mcp_tool(request: ToolCallRequest):
    """
    Directly invokes a single FastMCP tool by name.
    """
    tool_map = {
        "get_asset_reliability": lambda p: get_asset_reliability(p.get("asset_code", "PUMP-102")),
        "query_industrial_specifications": lambda p: query_industrial_specifications(p.get("asset_code", "PUMP-102"), p.get("query", "")),
        "evaluate_decision_guardrails": lambda p: evaluate_decision_guardrails(p.get("asset_code", "PUMP-102"), p.get("problem_statement", "")),
        "detect_sop_contradictions": lambda p: detect_sop_contradictions(p.get("asset_code", "PUMP-102")),
        "validate_sop_measurement": lambda p: validate_sop_measurement(p.get("asset_code", "PUMP-102"), p.get("parameter_name", ""), float(p.get("measured_value", 0.0)))
    }

    if request.tool not in tool_map:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tool '{request.tool}' not found in FastMCP registry. Available: {list(tool_map.keys())}"
        )

    try:
        output = tool_map[request.tool](request.parameters)
        return {
            "success": True,
            "tool": request.tool,
            "output": output
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing FastMCP tool '{request.tool}': {str(e)}"
        )

@router.get("/scenarios")
def get_demo_scenarios():
    """
    Provides pre-packaged live demo scenarios for technical interviews and presentations.
    """
    return {
        "success": True,
        "scenarios": [
            {
                "id": "scenario-1",
                "title": "PUMP-102 Impeller Clearance Out-of-Bounds",
                "assetCode": "PUMP-102",
                "anomaly": "Technician measured radial impeller clearance at 0.55 mm during routine overhaul.",
                "expectedOutcome": "Safety warning flagged (safe limit 0.25 - 0.45 mm); Action plan recommends impeller adjustment."
            },
            {
                "id": "scenario-2",
                "title": "PUMP-102 Cross-Document Contradiction Alert",
                "assetCode": "PUMP-102",
                "anomaly": "Investigating operational pressure discrepancy between SOP v1 (10 bar) and SOP v2 (8 bar).",
                "expectedOutcome": "Contradiction tool identifies conflicting thresholds; Risk elevated to High; Manager approval required."
            },
            {
                "id": "scenario-3",
                "title": "BOILER-04 Superheated Steam Pressure Spike",
                "assetCode": "BOILER-04",
                "anomaly": "Casing steam pressure sensor reads 52.0 bar with fluctuating steam discharge.",
                "expectedOutcome": "Critical hazard detected exceeding maximum 45.0 bar structural threshold; Immediate shutoff mandated."
            },
            {
                "id": "scenario-4",
                "title": "Low-Evidence Anomaly (Safety Abstention Guardrail)",
                "assetCode": "PUMP-102",
                "anomaly": "Unknown ultrasonic acoustic emissions detected on non-standard unmonitored bearing housing.",
                "expectedOutcome": "Decision Confidence Index (DCI) drops below 50%; Safety Abstention Protocol enforced."
            }
        ]
    }
