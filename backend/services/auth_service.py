"""
Authentication endpoints for user registration and login
"""

from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime, timedelta
import hashlib
import secrets
import jwt
import os
from pymongo import MongoClient
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# JWT Configuration  
SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Security
security = HTTPBearer()

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

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class AuthService:
    """Service for user authentication and management."""
    
    def __init__(self):
        self.mongo_client = None
        self.users_collection = None
        self._initialize_db()
    
    def _initialize_db(self):
        """Initialize MongoDB connection."""
        candidate_client = None
        try:
            mongo_uri = os.getenv('MONGODB_URI')
            db_name = os.getenv('DB_NAME', 'ai_crm_db')
            
            if not mongo_uri:
                logger.error("[ERROR] MongoDB URI not found in environment")
                return
            
            # Test connection with timeout - retry 3 times
            connection_success = False
            last_error = None
            
            for attempt in range(3):
                try:
                    candidate_client = MongoClient(
                        mongo_uri,
                        serverSelectionTimeoutMS=int(os.getenv('MONGO_SERVER_SELECTION_TIMEOUT_MS', '5000')),
                        connectTimeoutMS=int(os.getenv('MONGO_CONNECT_TIMEOUT_MS', '5000')),
                        socketTimeoutMS=int(os.getenv('MONGO_SOCKET_TIMEOUT_MS', '10000')),
                        maxPoolSize=int(os.getenv('MONGO_MAX_POOL_SIZE', '10')),
                        minPoolSize=0,
                        retryWrites=True,
                        retryReads=True,
                        directConnection=False
                    )

                    # Quick ping to test connection
                    candidate_client.admin.command('ping', maxTimeMS=5000)
                    self.mongo_client = candidate_client
                    db = self.mongo_client[db_name]
                    self.users_collection = db['users']
                    connection_success = True
                    break
                except Exception as retry_err:
                    last_error = retry_err
                    if candidate_client is not None:
                        try:
                            candidate_client.close()
                        except Exception:
                            pass
                        candidate_client = None
                    if attempt < 2:  # Not the last attempt
                        logger.warning(f"[RETRY] Auth service connection attempt {attempt+1} failed, retrying...")
            
            if not connection_success:
                logger.error(f"[ERROR] Failed to connect after 3 attempts: {last_error}")
                self.mongo_client = None
                self.users_collection = None
                return
            
            # Create unique index on email - do this in background
            try:
                self.users_collection.create_index(
                    [("email", 1)], 
                    unique=True, 
                    background=True
                )
            except Exception:
                pass  # Index might already exist
            
            logger.info("[OK] Auth service connected to MongoDB")
            
        except Exception as e:
            logger.error(f"[ERROR] Failed to initialize MongoDB: {e}")
            if candidate_client is not None:
                try:
                    candidate_client.close()
                except Exception:
                    pass
            if self.mongo_client is not None:
                try:
                    self.mongo_client.close()
                except Exception:
                    pass
            self.mongo_client = None
            self.users_collection = None
    
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
    
    def verify_token(self, token: str) -> dict:
        """Verify and decode a JWT token."""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    def register_user(self, user_data: UserSignup) -> dict:
        """Register a new user."""
        try:
            # Check if MongoDB is available
            if self.users_collection is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Database service unavailable. Please check MongoDB connection."
                )
            
            if str(user_data.role).lower() != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only admin accounts are allowed in this CRM system"
                )

            # Check if user already exists
            existing_user = self.users_collection.find_one({"email": user_data.email})
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            
            # Hash password
            hashed_password = self.hash_password(user_data.password)
            
            # Create user document
            user_doc = {
                "name": user_data.name,
                "email": user_data.email,
                "password": hashed_password,
                "role": "admin",
                "created_at": datetime.utcnow().isoformat(),
                "is_active": True
            }
            
            # Insert user
            result = self.users_collection.insert_one(user_doc)
            user_id = str(result.inserted_id)
            
            # Create access token
            token_data = {"sub": user_id, "email": user_data.email, "role": "admin"}
            access_token = self.create_access_token(token_data)
            
            # Return response
            user_response = UserResponse(
                id=user_id,
                name=user_data.name,
                email=user_data.email,
                role="admin",
                created_at=user_doc["created_at"]
            )
            
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
        """Login a user."""
        try:
            # Check if MongoDB is available
            if self.users_collection is None:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Database service unavailable. Please check MongoDB connection."
                )
            
            # Find user by email
            user = self.users_collection.find_one({"email": login_data.email})
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

            if str(user.get("role", "")).lower() != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only admin accounts are allowed to access this CRM"
                )
            
            # Create access token
            user_id = str(user["_id"])
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
    
    def get_current_user(self, credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
        """Get current user from JWT token."""
        try:
            payload = self.verify_token(credentials.credentials)
            user_id = payload.get("sub")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
            
            # Get user from database
            from bson import ObjectId
            user = self.users_collection.find_one({"_id": ObjectId(user_id)})
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )
            
            return {
                "id": str(user["_id"]),
                "name": user["name"],
                "email": user["email"],
                "role": user["role"]
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Token verification error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

# Global auth service instance - lazy initialization to prevent startup hangs
_auth_service = None

def get_auth_service():
    """
    Get the auth service instance with lazy initialization.
    This prevents MongoDB connection issues from blocking imports.
    """
    global _auth_service
    if _auth_service is None:
        try:
            _auth_service = AuthService()
            logger.info("✅ Auth service initialized successfully")
        except Exception as e:
            logger.error(f"❌ Failed to initialize auth service: {e}")
            # Return a mock service that always returns errors
            _auth_service = MockAuthService()
    return _auth_service

class MockAuthService:
    """Mock auth service for when initialization fails."""
    
    def __init__(self):
        self.users_collection = None
        
    def register_user(self, user_data):
        raise HTTPException(
            status_code=500,
            detail="Auth service not available - check MongoDB connection"
        )
    
    def login_user(self, login_data):
        raise HTTPException(
            status_code=500, 
            detail="Auth service not available - check MongoDB connection"
        )
    
    def get_current_user(self):
        raise HTTPException(
            status_code=500,
            detail="Auth service not available - check MongoDB connection"
        )

# For backwards compatibility - create a simple lazy-loaded variable
class LazyAuthService:
    """Wrapper for lazy-loaded service."""
    def __init__(self):
        self._service = None
    
    def __getattr__(self, name):
        if self._service is None:
            self._service = get_auth_service()
        return getattr(self._service, name)

# Create module-level instance
auth_service = LazyAuthService()