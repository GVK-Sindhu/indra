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
    Auto-seeds database if empty and guarantees demo account login.
    """
    db = get_db()
    email_clean = request.email.strip().lower()

    # Pre-defined demo seed accounts for instant reliable login during presentations
    demo_accounts = {
        "engineer@indra.ai": ("engineer123", "Alex Doe", "ENGINEER", "Junior"),
        "manager@indra.ai": ("manager123", "Sarah Smith", "MANAGER", "Senior"),
        "admin@indra.ai": ("admin123", "Sys Admin", "ADMIN", "Senior")
    }

    # 1. Auto-seed database if empty
    if db.users.count_documents({}) == 0:
        from app.core.seeder import seed_database_if_needed
        seed_database_if_needed()

    # 2. Guarantee demo accounts login immediately
    if email_clean in demo_accounts and request.password == demo_accounts[email_clean][0]:
        pwd, name, role, exp = demo_accounts[email_clean]
        user = db.users.find_one({"email": email_clean})
        if not user:
            res = db.users.insert_one({
                "email": email_clean,
                "password": hash_password(pwd),
                "passwordHash": hash_password(pwd),
                "name": name,
                "role": role,
                "experienceLevel": exp,
                "createdAt": datetime.utcnow(),
                "updatedAt": datetime.utcnow()
            })
            user_id = str(res.inserted_id)
        else:
            user_id = str(user["_id"])

        token = create_access_token({
            "id": user_id,
            "userId": user_id,
            "email": email_clean,
            "role": role
        })

        return {
            "success": True,
            "token": token,
            "user": {
                "id": user_id,
                "email": email_clean,
                "name": user.get("name", name) if user else name,
                "role": role,
                "experienceLevel": exp
            }
        }

    # 3. Standard database lookup for registered accounts
    user = db.users.find_one({"email": email_clean})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password."
        )

    # 4. Verify password hash
    hashed_pwd = user.get("passwordHash") or user.get("password")
    if not hashed_pwd or not verify_password(request.password, hashed_pwd):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or password."
        )

    user_id = str(user["_id"])

    # 5. Generate token
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
