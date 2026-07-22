import bcrypt
import jwt
from datetime import datetime, timedelta
from app.core.config import settings

def hash_password(password: str) -> str:
    """
    Hashes a plain-text password using bcrypt blowfish hashing.
    """
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against an existing bcrypt hash.
    Supports Blowfish hashes ($2a$, $2b$).
    """
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        print(f"[Security] Bcrypt check failed: {str(e)}")
        return False

def create_access_token(data: dict) -> str:
    """
    Generates a signed JWT access token containing user payload details.
    """
    to_encode = data.copy()
    if "id" in to_encode and "userId" not in to_encode:
        to_encode["userId"] = to_encode["id"]
    elif "userId" in to_encode and "id" not in to_encode:
        to_encode["id"] = to_encode["userId"]
    
    # Parse expiry configuration. Node uses "24h"
    hours = 24
    if "24h" in settings.JWT_EXPIRES_IN:
        hours = 24
    
    expire = datetime.utcnow() + timedelta(hours=hours)
    to_encode.update({"exp": int(expire.timestamp())}) # standard epoch integer
    
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
    # In PyJWT 2.0+, encode returns a string. In older versions, it returns bytes.
    if isinstance(encoded_jwt, bytes):
        return encoded_jwt.decode('utf-8')
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decodes and verifies a JWT access token.
    Raises PyJWTError on signature expiration or invalid signatures.
    """
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
