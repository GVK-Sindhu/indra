from bson import ObjectId
from datetime import datetime
from fastapi import HTTPException, status

from app.db.mongodb import get_db

def start_execution_session(procedure_id: str, asset_id: str, engineer_id: str) -> dict:
    """
    Starts a new SOP guided checklist execution session, or resumes an existing active run.
    """
    db = get_db()
    proc_oid = ObjectId(procedure_id)
    asset_oid = ObjectId(asset_id)
    eng_oid = ObjectId(engineer_id)

    # 1. Check if user already has an ongoing active session
    active_session = db.executionsessions.find_one({
        "engineerId": eng_oid,
        "status": "Active"
    })
    
    if active_session:
        print(f"[ExecutionService] Resuming active session: {active_session['_id']}")
        return format_session_response(active_session)

    # 2. Fetch procedure SOP steps
    procedure = db.procedures.find_one({"_id": proc_oid})
    if not procedure:
        raise HTTPException(status_code=404, detail="SOP Procedure not found.")

    # Initialize checklist steps states
    session_steps = []
    for step in procedure.get("steps", []):
        session_steps.append({
            "stepNumber": step["stepNumber"],
            "completed": False,
            "completedAt": None,
            "measurementName": None,
            "measurementValue": None,
            "notes": None,
            "image": None
        })

    # 3. Create Session document in MongoDB
    session_oid = ObjectId()
    db.executionsessions.insert_one({
        "_id": session_oid,
        "procedureId": proc_oid,
        "assetId": asset_oid,
        "engineerId": eng_oid,
        "status": "Active",
        "steps": session_steps,
        "warningsRaised": [],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    })

    new_session = db.executionsessions.find_one({"_id": session_oid})
    return format_session_response(new_session)

def validate_execution_step(
    session_id_str: str,
    step_number: int,
    completed: bool,
    measurement_name: str = None,
    measurement_value: float = None,
    notes: str = None,
    image: str = None
) -> dict:
    """
    Updates a step in the checklist, running deterministic bounds verification
    on numeric measurement entries and raising warnings if thresholds are breached.
    """
    db = get_db()
    sess_oid = ObjectId(session_id_str)

    session = db.executionsessions.find_one({"_id": sess_oid})
    if not session:
        raise HTTPException(status_code=404, detail="Execution session not found.")

    if session.get("status") != "Active":
        raise HTTPException(status_code=400, detail="Cannot edit a closed session.")

    # Fetch procedure step settings
    procedure = db.procedures.find_one({"_id": session["procedureId"]})
    if not procedure:
        raise HTTPException(status_code=404, detail="Procedure SOP associated with session not found.")

    step_config = next((s for s in procedure.get("steps", []) if s["stepNumber"] == step_number), None)
    if not step_config:
        raise HTTPException(status_code=404, detail=f"Step configuration {step_number} not found.")

    # Execute deterministic bounds check for validationType: 'Measurement'
    warning_raised = None
    if step_config.get("validationType") == "Measurement" and measurement_value is not None:
        val = float(measurement_value)
        # Scan step measurements limits configuration
        for m in step_config.get("measurements", []):
            if m["name"] == measurement_name:
                min_lim = m.get("minLimit")
                max_lim = m.get("maxLimit")
                unit = m.get("unit", "")
                
                if min_lim is not None and val < min_lim:
                    warning_raised = f"Safety warning: measurement value {val} {unit} is below manufacturer lower bound of {min_lim} {unit}."
                elif max_lim is not None and val > max_lim:
                    warning_raised = f"Safety warning: measurement value {val} {unit} exceeds manufacturer upper limit of {max_lim} {unit}."

    # Update steps list in DB session document
    steps = session.get("steps", [])
    step_idx = next((i for i, s in enumerate(steps) if s["stepNumber"] == step_number), None)
    
    if step_idx is not None:
        steps[step_idx] = {
            "stepNumber": step_number,
            "completed": completed,
            "completedAt": datetime.utcnow() if completed else None,
            "measurementName": measurement_name,
            "measurementValue": measurement_value,
            "notes": notes,
            "image": image
        }

    warnings_list = session.get("warningsRaised", [])
    if warning_raised and warning_raised not in warnings_list:
        warnings_list.append(warning_raised)

    db.executionsessions.update_one(
        {"_id": sess_oid},
        {"$set": {
            "steps": steps,
            "warningsRaised": warnings_list,
            "updatedAt": datetime.utcnow()
        }}
    )

    updated_session = db.executionsessions.find_one({"_id": sess_oid})
    result_session = format_session_response(updated_session)

    return {
        "success": True,
        "warning": warning_raised,
        "session": result_session
    }

def complete_execution_session(session_id_str: str, outcome: str, feedback: str, lessons_learned: str) -> dict:
    """
    Finalizes and archives the active checklist execution session.
    """
    db = get_db()
    sess_oid = ObjectId(session_id_str)

    session = db.executionsessions.find_one({"_id": sess_oid})
    if not session:
        raise HTTPException(status_code=404, detail="Execution session not found.")

    db.executionsessions.update_one(
        {"_id": sess_oid},
        {"$set": {
            "status": "Completed",
            "outcome": outcome,
            "feedback": feedback,
            "lessonsLearned": lessons_learned,
            "completedAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }}
    )

    updated_session = db.executionsessions.find_one({"_id": sess_oid})
    return format_session_response(updated_session)

def fail_execution_session(session_id_str: str, outcome: str, feedback: str, lessons_learned: str) -> dict:
    """
    Aborts and logs a failed SOP execution run.
    """
    db = get_db()
    sess_oid = ObjectId(session_id_str)

    session = db.executionsessions.find_one({"_id": sess_oid})
    if not session:
        raise HTTPException(status_code=404, detail="Execution session not found.")

    db.executionsessions.update_one(
        {"_id": sess_oid},
        {"$set": {
            "status": "Failed",
            "outcome": outcome,
            "feedback": feedback,
            "lessonsLearned": lessons_learned,
            "completedAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }}
    )

    updated_session = db.executionsessions.find_one({"_id": sess_oid})
    return format_session_response(updated_session)

def format_session_response(sess: dict) -> dict:
    """
    Serializes BSON ObjectID fields and Datetimes for compatibility with camelCase outputs.
    """
    if not sess:
        return {}
    res = sess.copy()
    res["id"] = str(res["_id"])
    del res["_id"]
    res["procedureId"] = str(res["procedureId"])
    res["assetId"] = str(res["assetId"])
    res["engineerId"] = str(res["engineerId"])
    
    # Format steps
    for s in res.get("steps", []):
        if isinstance(s.get("completedAt"), datetime):
            s["completedAt"] = s["completedAt"].isoformat()
            
    if isinstance(res.get("completedAt"), datetime):
        res["completedAt"] = res["completedAt"].isoformat()
    if isinstance(res.get("createdAt"), datetime):
        res["createdAt"] = res["createdAt"].isoformat()
    if isinstance(res.get("updatedAt"), datetime):
        res["updatedAt"] = res["updatedAt"].isoformat()
        
    return res
