from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import sys
import traceback

from app.core.config import settings
from app.core.seeder import seed_database_if_needed
from app.db.mongodb import get_db, get_mongo_client
from app.services.vector_store import get_collection

# Import API Routers
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.documents import router as documents_router
from app.api.v1.integrity import router as integrity_router
from app.api.v1.decisions import router as decisions_router
from app.api.v1.execution import router as execution_router
from app.api.v1.analytics import router as analytics_router

app = FastAPI(
    title="INDRA Unified Backend",
    description="Python FastAPI consolidated backend for safety-critical industrial intelligence",
    version="2.0.0"
)

# Enable CORS for React/Vite development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

# Centralized global exception handler
@app.exception_handler(Exception)
def global_exception_handler(request, exc):
    """
    Catches unhandled errors globally, preventing server crashes and returning
    standard JSON error shapes.
    """
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "message": f"Internal Server Error: {str(exc)}",
                "code": "INTERNAL_SERVER_ERROR"
            }
        }
    )

@app.exception_handler(StarletteHTTPException)
def http_exception_handler(request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "message": exc.detail,
                "code": f"HTTP_{exc.status_code}"
            }
        }
    )

@app.exception_handler(RequestValidationError)
def validation_exception_handler(request, exc: RequestValidationError):
    errors = exc.errors()
    message = "; ".join([f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}" for err in errors])
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": {
                "message": f"Validation Error: {message}",
                "code": "VALIDATION_ERROR",
                "details": [err["msg"] for err in errors]
            }
        }
    )

# Root-level health check endpoints
@app.get("/health")
@app.get("/ai/health")
@app.get("/api/v1/health")
def health_status():
    """
    Health check utility, verifying connections to MongoDB and ChromaDB.
    """
    db_status = "DOWN"
    chroma_status = "DOWN"
    
    # 1. Check MongoDB
    try:
        client = get_mongo_client()
        client.server_info()
        db_status = "UP"
    except Exception:
        pass

    # 2. Check ChromaDB
    try:
        get_collection()
        chroma_status = "UP"
    except Exception:
        pass

    return {
        "status": "UP" if (db_status == "UP" and chroma_status == "UP") else "DEGRADED",
        "service": "INDRA Unified FastAPI Backend",
        "database": db_status,
        "chromadb": chroma_status
    }

# Bind API sub-routers
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(documents_router, prefix="/api/v1")
app.include_router(integrity_router, prefix="/api/v1")
app.include_router(decisions_router, prefix="/api/v1")
app.include_router(execution_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")

@app.on_event("startup")
def startup_event():
    """
    Executes database seeders on server boot if enabled.
    """
    try:
        seed_database_if_needed()
    except Exception as e:
        print(f"[Main] Seeding failed during startup: {str(e)}", file=sys.stderr)

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True
    )
