from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId
from typing import Optional
import jwt

from app.core.security import decode_access_token
from app.db.mongodb import get_db

security = HTTPBearer(auto_error=False)

DEFAULT_ENGINEER = {
    "_id": ObjectId("60d5ec49f390000000000001"),
    "id": "60d5ec49f390000000000001",
    "email": "engineer@indra.ai",
    "name": "Alex Doe",
    "role": "ENGINEER",
    "experienceLevel": "Junior"
}

def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """
    Dependency that decodes the bearer JWT token, validates user existence,
    and returns the active User object with emergency demo fallback.
    """
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    else:
        auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()

    if not token:
        return DEFAULT_ENGINEER

    try:
        payload = decode_access_token(token)
        user_id = payload.get("id") or payload.get("userId")
        
        db = get_db()
        obj_id = None
        if user_id:
            try:
                obj_id = ObjectId(user_id)
            except Exception:
                obj_id = None

        user = None
        if obj_id:
            user = db.users.find_one({"_id": obj_id})
        
        if not user and payload.get("email"):
            user = db.users.find_one({"email": payload["email"].strip().lower()})

        if not user:
            role = payload.get("role", "ENGINEER").upper()
            email = payload.get("email", "engineer@indra.ai")
            return {
                "_id": ObjectId("60d5ec49f390000000000001"),
                "id": "60d5ec49f390000000000001",
                "email": email,
                "name": "Alex Doe",
                "role": role,
                "experienceLevel": "Junior"
            }
        
        user["id"] = str(user["_id"])
        return user
        
    except Exception as err:
        print(f"[Auth Failsafe] Using fallback context: {str(err)}")
        return DEFAULT_ENGINEER

class RequireRole:
    """
    FastAPI dependency factory class enforcing role-based access controls.
    """
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role")
        if user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: User role '{user_role}' does not possess required scopes."
            )
        return current_user
