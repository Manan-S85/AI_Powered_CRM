"""
Development-only auth service that works without MongoDB.
Uses in-memory storage for users.
"""

from fastapi import HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import hashlib
import secrets
import jwt
import os
import uuid
import logging

logger = logging.getLogger(__name__)

# JWT Configuration  
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# In-memory user storage (for development only)
_users_db = {}

class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "admin"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class DevAuthService:
    """Development auth service that works without MongoDB."""
    
    def __init__(self):
        self.users_collection = None  # Not using MongoDB
        # Silently use dev mode
        logger.info("[DEV] In-memory auth initialized")
    
    def hash_password(self, password: str) -> str:
        """Hash a password using Python's built-in hashlib."""
        salt = secrets.token_hex(16)
        pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return f"{salt}${pwd_hash.hex()}"
    
    def verify_password(self, password: str, hashed: str) -> bool:
        """Verify a password against its hash."""
        try:
            salt, pwd_hash = hashed.split('$')
            new_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
            return new_hash.hex() == pwd_hash
        except:
            return False
    
    def create_access_token(self, data: dict) -> str:
        """Create a JWT access token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    def register_user(self, user_data: UserSignup) -> dict:
        """Register a new user (in-memory)."""
        try:
            if str(user_data.role).lower() != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only admin accounts are allowed in this CRM system"
                )

            # Check if user already exists
            if user_data.email in _users_db:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            
            # Hash password
            hashed_password = self.hash_password(user_data.password)
            
            # Create user
            user_id = str(uuid.uuid4())
            user = {
                "id": user_id,
                "name": user_data.name,
                "email": user_data.email,
                "password": hashed_password,
                "role": "admin",
                "created_at": datetime.utcnow().isoformat(),
                "is_active": True
            }
            
            # Store in memory
            _users_db[user_data.email] = user
            
            # Create access token
            token_data = {"sub": user_id, "email": user_data.email, "role": "admin"}
            access_token = self.create_access_token(token_data)
            
            logger.info(f"[DEV] User registered: {user_data.email}")
            
            # Return response
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": user_id,
                    "name": user_data.name,
                    "email": user_data.email,
                    "role": "admin",
                    "created_at": user["created_at"]
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Registration error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create user: {str(e)}"
            )
    
    def login_user(self, login_data: UserLogin) -> dict:
        """Login a user (from memory)."""
        try:
            # Find user
            user = _users_db.get(login_data.email)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password"
                )
            
            # Verify password
            if not self.verify_password(login_data.password, user["password"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password"
                )

            if str(user.get("role", "")).lower() != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only admin accounts are allowed to access this CRM"
                )
            
            # Create access token
            token_data = {"sub": user["id"], "email": user["email"], "role": user["role"]}
            access_token = self.create_access_token(token_data)
            
            logger.info(f"[DEV] User logged in: {login_data.email}")
            
            # Return response
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": {
                    "id": user["id"],
                    "name": user["name"],
                    "email": user["email"],
                    "role": user["role"],
                    "created_at": user["created_at"]
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Login error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Login failed: {str(e)}"
            )

# Create dev auth service instance
dev_auth_service = DevAuthService()
