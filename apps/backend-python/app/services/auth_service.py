from fastapi import HTTPException, status
from datetime import datetime
from bson import ObjectId

from app.db.mongodb import get_db
from app.models.user import UserRegisterRequest, UserLoginRequest, UserResponse
from app.core.security import hash_password, verify_password, create_access_token

def register_user(request: UserRegisterRequest) -> dict:
    """
    Registers a new system user account, checking for duplicates and hashing the password.
    """
    db = get_db()
    email_clean = request.email.strip().lower()
    
    # 1. Check if user already exists
    existing = db.users.find_one({"email": email_clean})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user account with this email address already exists."
        )

    # 2. Hash password and insert
    hashed_pwd = hash_password(request.password)
    user_doc = {
        "email": email_clean,
        "password": hashed_pwd,
        "passwordHash": hashed_pwd, # for Node compatibility
        "name": request.name.strip(),
        "role": request.role.upper(),
        "experienceLevel": request.experience_level, # map directly to Mongoose casing
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    result = db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    # 3. Generate access token
    token = create_access_token({
        "id": user_id,
        "userId": user_id,
        "email": email_clean,
        "role": request.role.upper()
    })

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "email": email_clean,
            "name": request.name.strip(),
            "role": request.role.upper(),
            "experienceLevel": request.experience_level
        }
    }

def login_user(request: UserLoginRequest) -> dict:
    """
    Validates credentials and logs in the user, returning a signed JWT token.
    """
    db = get_db()
    email_clean = request.email.strip().lower()

    # 1. Find user by email
    user = db.users.find_one({"email": email_clean})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password."
        )

    # 2. Verify password hash
    hashed_pwd = user.get("passwordHash") or user.get("password")
    if not hashed_pwd or not verify_password(request.password, hashed_pwd):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password."
        )

    user_id = str(user["_id"])

    # 3. Generate token
    token = create_access_token({
        "id": user_id,
        "userId": user_id,
        "email": email_clean,
        "role": user["role"]
    })

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id,
            "email": email_clean,
            "name": user["name"],
            "role": user["role"],
            "experienceLevel": user.get("experienceLevel", "Junior")
        }
    }
