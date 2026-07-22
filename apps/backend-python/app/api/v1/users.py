from fastapi import APIRouter, Depends
from app.core.dependencies import RequireRole
from app.db.mongodb import get_db

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/", dependencies=[Depends(RequireRole(["ADMIN"]))])
def list_users():
    """
    Exposes full listing of registered system users. Restricts access to ADMIN.
    """
    db = get_db()
    
    # Query all users, hiding hashed passwords in response projection
    users = list(db.users.find({}, {"password": 0, "passwordHash": 0}))
    
    for u in users:
        u["id"] = str(u["_id"])
        del u["_id"]
        
    return {
        "success": True,
        "data": {
            "users": users
        }
    }
