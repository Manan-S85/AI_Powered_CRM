"""
Development Authentication Service with In-Memory Storage
Fallback when MongoDB is not available
"""

from fastapi import HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Dict
from datetime import datetime, timedelta
import hashlib
import secrets
import jwt
import os
from dotenv import load_dotenv
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440

class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "admin"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    created_at: str

class DevAuthService:
    """Development auth service with in-memory storage."""
    
    def __init__(self):
        self.users: Dict[str, dict] = {}
        logger.info("[DEV MODE] Using in-memory authentication (MongoDB unavailable)")
        
        # Create default admin user for testing
        self._create_default_admin()
    
    def _create_default_admin(self):
        """Create a default admin user for testing."""
        try:
            default_admin = {
                "name": "Admin User",
                "email": "admin@example.com",
                "password": self.hash_password("admin123"),
                "role": "admin",
                "created_at": datetime.utcnow().isoformat(),
                "is_active": True
            }
            self.users["admin@example.com"] = default_admin
            logger.info("[DEV] Default admin created: admin@example.com / admin123")
        except Exception as e:
            logger.error(f"Error creating default admin: {e}")
    
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
        """Register a new user in memory."""
        try:
            # Check if user already exists
            if user_data.email in self.users:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            
            # Hash password
            hashed_password = self.hash_password(user_data.password)
            
            # Create user document
            user_id = f"user_{len(self.users)}"
            user_doc = {
                "id": user_id,
                "name": user_data.name,
                "email": user_data.email,
                "password": hashed_password,
                "role": user_data.role,
                "created_at": datetime.utcnow().isoformat(),
                "is_active": True
            }
            
            # Store user
            self.users[user_data.email] = user_doc
            
            # Create access token
            token_data = {"sub": user_id, "email": user_data.email, "role": user_data.role}
            access_token = self.create_access_token(token_data)
            
            # Return response
            user_response = UserResponse(
                id=user_id,
                name=user_data.name,
                email=user_data.email,
                role=user_data.role,
                created_at=user_doc["created_at"]
            )
            
            logger.info(f"[DEV] User registered: {user_data.email}")
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": user_response
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Registration error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
    
    def login_user(self, login_data: UserLogin) -> dict:
        """Login a user from memory."""
        try:
            # Find user
            user = self.users.get(login_data.email)
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
            
            # Check if user is active
            if not user.get("is_active", True):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Account is disabled"
                )
            
            # Create access token
            user_id = user["id"]
            token_data = {"sub": user_id, "email": user["email"], "role": user["role"]}
            access_token = self.create_access_token(token_data)
            
            # Return response
            user_response = UserResponse(
                id=user_id,
                name=user["name"],
                email=user["email"],
                role=user["role"],
                created_at=user["created_at"]
            )
            
            logger.info(f"[DEV] User logged in: {login_data.email}")
            
            return {
                "access_token": access_token,
                "token_type": "bearer",
                "user": user_response
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Login error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Login failed"
            )

# Global instance
dev_auth_service = DevAuthService()
