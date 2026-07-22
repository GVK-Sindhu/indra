from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime

from app.core.dependencies import get_current_user
from app.db.mongodb import get_db
from app.services.execution_service import (
    start_execution_session,
    validate_execution_step,
    complete_execution_session,
    fail_execution_session,
    format_session_response
)

router = APIRouter(prefix="/execution", tags=["SOP Execution"])

@router.get("/active")
def get_active_session(current_user: dict = Depends(get_current_user)):
    """
    Retrieves the currently ongoing active checklist session for the user.
    """
    db = get_db()
    eng_oid = ObjectId(current_user["id"])
    
    session = db.executionsessions.find_one({
        "engineerId": eng_oid,
        "status": "Active"
    })
    
    if not session:
        return {
            "success": True,
            "data": {
                "session": None
            }
        }
        
    return {
        "success": True,
        "data": {
            "session": format_session_response(session)
        }
    }

@router.post("/start")
def start_session(body: dict, current_user: dict = Depends(get_current_user)):
    """
    Initiates a new SOP execution checklist or resumes an existing active run.
    """
    procedure_id = body.get("procedureId")
    asset_id = body.get("assetId")

    if not procedure_id or not asset_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fields 'procedureId' and 'assetId' are required."
        )

    try:
        ObjectId(procedure_id)
        ObjectId(asset_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID format.")

    session_response = start_execution_session(
        procedure_id=procedure_id,
        asset_id=asset_id,
        engineer_id=current_user["id"]
    )
    return {
        "success": True,
        "data": {
            "session": session_response
        }
    }

@router.put("/step")
def log_step_progress(body: dict, current_user: dict = Depends(get_current_user)):
    """
    Logs step completion parameters and runs safety validations.
    """
    session_id = body.get("sessionId")
    step_number = body.get("stepNumber")
    completed = body.get("completed", False)
    
    measurement_name = body.get("measurementName")
    measurement_value = body.get("measurementValue")
    notes = body.get("notes", "")
    image = body.get("image", "")

    if not session_id or step_number is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fields 'sessionId' and 'stepNumber' are required."
        )

    # Convert measurement value to float if present
    parsed_value = None
    if measurement_value is not None and measurement_value != "":
        try:
            parsed_value = float(measurement_value)
        except ValueError:
            raise HTTPException(status_code=400, detail="Measurement value must be numeric.")

    result = validate_execution_step(
        session_id_str=session_id,
        step_number=int(step_number),
        completed=bool(completed),
        measurement_name=measurement_name,
        measurement_value=parsed_value,
        notes=notes,
        image=image
    )
    return {
        "success": True,
        "data": {
            "session": result.get("session"),
            "warning": result.get("warning")
        }
    }

@router.post("/complete")
def complete_session(body: dict, current_user: dict = Depends(get_current_user)):
    """
    Concludes and archives a successful SOP run.
    """
    session_id = body.get("sessionId")
    outcome = body.get("outcome", "Completed successfully.")
    feedback = body.get("feedback", "")
    lessons_learned = body.get("lessonsLearned", "")

    if not session_id:
        raise HTTPException(status_code=400, detail="Field 'sessionId' is required.")

    session_response = complete_execution_session(
        session_id_str=session_id,
        outcome=outcome,
        feedback=feedback,
        lessons_learned=lessons_learned
    )
    return {
        "success": True,
        "data": {
            "session": session_response
        }
    }

@router.post("/fail")
def fail_session(body: dict, current_user: dict = Depends(get_current_user)):
    """
    Aborts and archives a failed SOP checklist run.
    """
    session_id = body.get("sessionId")
    outcome = body.get("outcome", "Procedure aborted / failed.")
    feedback = body.get("feedback", "")
    lessons_learned = body.get("lessonsLearned", "")

    if not session_id:
        raise HTTPException(status_code=400, detail="Field 'sessionId' is required.")

    session_response = fail_execution_session(
        session_id_str=session_id,
        outcome=outcome,
        feedback=feedback,
        lessons_learned=lessons_learned
    )
    return {
        "success": True,
        "data": {
            "session": session_response
        }
    }

@router.get("/procedures")
def list_procedures(current_user: dict = Depends(get_current_user)):
    """
    Exposes full listing of checklist procedures SOPs.
    """
    db = get_db()
    procs = list(db.procedures.find({}))
    
    for p in procs:
        p["id"] = str(p["_id"])
        del p["_id"]
        p["assetId"] = str(p["assetId"])
        for s in p.get("steps", []):
            for r in s.get("docReferences", []):
                r["documentId"] = str(r["documentId"])
                
    return {
        "success": True,
        "data": {
            "procedures": procs
        }
    }

