from fastapi import APIRouter, Depends, status
from app.models.user import UserRegisterRequest, UserLoginRequest
from app.services.auth_service import register_user, login_user
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(request: UserRegisterRequest):
    """
    User registration endpoint
    """
    res = register_user(request)
    return {
        "success": res.get("success", True),
        "data": {
            "token": res.get("token"),
            "user": res.get("user")
        }
    }

@router.post("/login")
def login(request: UserLoginRequest):
    """
    User login endpoint
    """
    res = login_user(request)
    return {
        "success": res.get("success", True),
        "data": {
            "token": res.get("token"),
            "user": res.get("user")
        }
    }

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """
    Restores active user context profile from bearer JWT signature
    """
    return {
        "success": True,
        "data": {
            "user": {
                "id": current_user["id"],
                "email": current_user["email"],
                "name": current_user["name"],
                "role": current_user["role"],
                "experienceLevel": current_user.get("experienceLevel", "Junior")
            }
        }
    }

