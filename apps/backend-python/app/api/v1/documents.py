from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks, HTTPException, status
from bson import ObjectId
from datetime import datetime
import json
import os
from typing import Optional
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.db.mongodb import get_db
from app.services.document_service import process_document_pipeline

router = APIRouter(prefix="/documents", tags=["Documents"])

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/process", status_code=status.HTTP_202_ACCEPTED)
def process_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    type: Optional[str] = Form(None),
    assets: Optional[str] = Form("[]"),
    description: Optional[str] = Form(""),
    tags: Optional[str] = Form("[]"),
    current_user: dict = Depends(get_current_user)
):
    """
    Accepts a PDF document upload, logs the document draft, and spins up the
    text parsing and vector database RAG indexing worker in the background.
    """
    supported_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".csv", ".xlsx", ".xls", ".txt", ".log", ".md"}
    unsupported_extensions = {".docx", ".json"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext in unsupported_extensions or ext not in supported_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format not currently supported in this prototype."
        )

    try:
        # Derive title automatically if missing
        if not title or not title.strip():
            filename_base = os.path.splitext(file.filename)[0]
            title = filename_base.replace("-", " ").replace("_", " ").strip()
        else:
            title = title.strip()

        # Derive type automatically if missing
        if not type or not type.strip():
            if ext == ".pdf":
                type = "PDF"
            elif ext in [".xls", ".xlsx"]:
                type = "EXCEL"
            elif ext in [".txt", ".log", ".md"]:
                type = "TEXT"
            elif ext == ".csv":
                type = "CSV"
            elif ext in [".png", ".jpg", ".jpeg"]:
                type = "IMAGE"
            elif ext in [".doc", ".docx"]:
                type = "WORD"
            else:
                type = "DOCUMENT"
        else:
            type = type.upper()

        if not description or not description.strip():
            description = f"Uploaded file: {file.filename}"
        else:
            description = description.strip()

        # Parse inputs
        parsed_assets = []
        if assets:
            try:
                parsed_assets = json.loads(assets) if isinstance(assets, str) and assets.startswith("[") else [assets] if assets else []
            except Exception:
                parsed_assets = [assets]
        
        parsed_tags = []
        if tags:
            try:
                parsed_tags = json.loads(tags) if isinstance(tags, str) and tags.startswith("[") else [tags] if tags else []
            except Exception:
                parsed_tags = [tags]
        
        # Read file bytes
        file_bytes = file.file.read()
        
        # Save file to uploads folder
        file_path = os.path.join(UPLOAD_DIR, f"{int(datetime.utcnow().timestamp())}_{file.filename}")
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        db = get_db()
        doc_oid = ObjectId()
        user_oid = ObjectId(current_user["id"])

        # Construct Document record
        doc_record = {
            "_id": doc_oid,
            "title": title,
            "description": description,
            "type": type,
            "assets": parsed_assets,
            "versions": [{
                "versionNumber": 1,
                "fileName": file.filename,
                "filePath": file_path,
                "contentId": file_path, # local path mapped to contentId for Node.js fallback
                "mimeType": file.content_type or "application/octet-stream",
                "size": len(file_bytes),
                "uploadedBy": user_oid,
                "uploadedAt": datetime.utcnow()
            }],
            "tags": parsed_tags,
            "processingStatus": "PENDING",
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }

        db.documents.insert_one(doc_record)

        # Offload parsing and extraction pipelines to FastAPI background tasks
        background_tasks.add_task(
            process_document_pipeline,
            document_id=str(doc_oid),
            version_number=1,
            file_name=file.filename,
            file_bytes=file_bytes,
            uploaded_by_str=current_user["id"]
        )

        return {
            "success": True,
            "data": {
                "documentId": str(doc_oid),
                "title": title,
                "status": "Draft",
                "processingStatus": "PENDING"
            }
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start document ingestion: {str(e)}"
        )

@router.get("/status/{document_id}")
def get_document_status(document_id: str, current_user: dict = Depends(get_current_user)):
    """
    Polls the background extraction progress status for a document.
    """
    db = get_db()
    try:
        doc_oid = ObjectId(document_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid document ID format.")

    doc = db.documents.find_one({"_id": doc_oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    return {
        "success": True,
        "data": {
            "id": str(doc_oid),
            "title": doc.get("title"),
            "type": doc.get("type"),
            "status": doc.get("status", "Draft"),
            "processingStatus": doc.get("processingStatus", "PENDING"),
            "errorMessage": doc.get("processingError"),
            "processingError": doc.get("processingError"),
            "assets": doc.get("assets", []),
            "tags": doc.get("tags", []),
            "updatedAt": doc.get("updatedAt", datetime.utcnow()).isoformat() if isinstance(doc.get("updatedAt"), datetime) else doc.get("updatedAt")
        }
    }

class VoiceCapturePayload(BaseModel):
    title: str
    transcript: str
    expertName: Optional[str] = "Retiring Senior Expert"
    assetCode: Optional[str] = "GENERAL"
    category: Optional[str] = "TROUBLESHOOTING"

@router.post("/voice-capture", status_code=status.HTTP_202_ACCEPTED)
def capture_voice_knowledge(
    payload: VoiceCapturePayload,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Ingests transcribed oral operational knowledge spoken by retiring senior engineers
    into RAG vector storage and MongoDB compiled knowledge facts.
    """
    if not payload.transcript or not payload.transcript.strip():
        raise HTTPException(status_code=400, detail="Voice transcript cannot be empty.")
    
    title = payload.title.strip() if payload.title and payload.title.strip() else "Retiring Expert Oral Knowledge Record"
    safe_filename = f"voice_{int(datetime.utcnow().timestamp())}.txt"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    formatted_content = (
        f"--- RETIRING EXPERT ORAL KNOWLEDGE TRANSCRIPT ---\n"
        f"Title: {title}\n"
        f"Recorded Expert: {payload.expertName}\n"
        f"Target Asset: {payload.assetCode}\n"
        f"Knowledge Category: {payload.category}\n"
        f"Recorded Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
        f"--- SPOKEN OPERATIONAL EXPERTISE & PROCEDURES ---\n"
        f"{payload.transcript.strip()}\n"
    )
    
    file_bytes = formatted_content.encode('utf-8')
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    db = get_db()
    doc_oid = ObjectId()
    user_oid = ObjectId(current_user["id"])

    doc_record = {
        "_id": doc_oid,
        "title": f"[Voice Knowledge] {title}",
        "description": f"Oral operational knowledge recorded by {payload.expertName} ({payload.category})",
        "type": "VOICE_TRANSCRIPT",
        "assets": [payload.assetCode] if payload.assetCode and payload.assetCode != "GENERAL" else [],
        "versions": [{
            "versionNumber": 1,
            "fileName": safe_filename,
            "filePath": file_path,
            "contentId": file_path,
            "mimeType": "text/plain",
            "size": len(file_bytes),
            "uploadedBy": user_oid,
            "uploadedAt": datetime.utcnow()
        }],
        "tags": ["VOICE_CAPTURE", "RETIRING_EXPERT_KNOWLEDGE", payload.category],
        "processingStatus": "PENDING",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

    db.documents.insert_one(doc_record)

    background_tasks.add_task(
        process_document_pipeline,
        document_id=str(doc_oid),
        version_number=1,
        file_name=safe_filename,
        file_bytes=file_bytes,
        uploaded_by_str=current_user["id"]
    )

    return {
        "success": True,
        "data": {
            "documentId": str(doc_oid),
            "title": title,
            "status": "Draft",
            "processingStatus": "PENDING"
        }
    }

@router.get("")
@router.get("/")
def list_documents(current_user: dict = Depends(get_current_user)):
    """
    Exposes full listing of technical manuals and procedures catalog.
    """
    db = get_db()
    docs = list(db.documents.find({}))
    
    for d in docs:
        d["id"] = str(d["_id"])
        del d["_id"]
        # Serialize version user IDs
        for v in d.get("versions", []):
            if v.get("uploadedBy"):
                v["uploadedBy"] = str(v["uploadedBy"])
            if isinstance(v.get("uploadedAt"), datetime):
                v["uploadedAt"] = v["uploadedAt"].isoformat()
                
    return {
        "success": True,
        "data": {
            "documents": docs
        }
    }

