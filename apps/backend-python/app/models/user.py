from typing import Optional
from datetime import datetime
from pydantic import Field
from app.models.base import CamelModel, PyObjectId

class User(CamelModel):
    """
    Pydantic schema representing the User model stored in MongoDB.
    """
    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    email: str
    password: str # Stores bcrypt hash
    name: str
    role: str # ENGINEER, MANAGER, ADMIN
    experience_level: str # Junior, Mid, Senior
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class UserRegisterRequest(CamelModel):
    email: str
    password: str
    name: str
    role: str = "ENGINEER"
    experience_level: str = "Junior"

class UserLoginRequest(CamelModel):
    email: str
    password: str

class UserResponse(CamelModel):
    id: PyObjectId
    email: str
    name: str
    role: str
    experience_level: str
