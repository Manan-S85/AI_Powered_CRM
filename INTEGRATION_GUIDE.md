# AI-Powered CRM - Complete Integration Guide

## 🎯 System Overview

This AI-Powered CRM system is fully integrated with:
- **Frontend**: React + Vite (Port 3000)
- **Backend**: FastAPI (Port 8000)
- **Database**: MongoDB Atlas
- **ML Model**: Lead Temperature Prediction

## 🏗️ Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  React Frontend │────────▶│  FastAPI        │────────▶│  MongoDB Atlas  │
│  (Port 3000)    │         │  Backend        │         │  (Cloud)        │
│                 │         │  (Port 8000)    │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                    │                             │
                                    │                             │
                                    ▼                             ▼
                            ┌─────────────────┐         ┌─────────────────┐
                            │                 │         │                 │
                            │  ML Prediction  │────────▶│  Collections:   │
                            │  Service        │         │  - users        │
                            │                 │         │  - leads        │
                            └─────────────────┘         └─────────────────┘
```

## 🔑 Key Features

### 1. **User Authentication** ✅
- **Signup**: New users register and details are stored in MongoDB `users` collection
- **Login**: Users authenticate using stored credentials
- **JWT Tokens**: Secure token-based authentication
- **Role-Based Access**: Admin and user roles supported

### 2. **Frontend-Backend Integration** ✅
- Frontend makes API calls to `http://localhost:8000`
- CORS enabled for seamless communication
- Proper error handling and timeouts
- Response format: `{success: true/false, data, message}`

### 3. **MongoDB Integration** ✅
- **Users Collection**: Stores user accounts (signup/login)
- **Leads Collection**: Stores lead data with ML predictions
- **Automatic Save**: Leads are automatically saved when processed
- **Unique IDs**: Each lead gets a unique identifier

### 4. **ML Model Integration** ✅
- Trained model for lead temperature prediction (Hot/Warm/Cold)
- Processes leads and saves results to MongoDB
- Provides confidence scores and probabilities
- Batch processing capability

## 📁 Project Structure

```
AI_Powered_CRM/
├── .env                          # Environment configuration
├── start_backend_server.bat      # Start backend (Windows)
├── start_frontend.bat            # Start frontend (Windows)
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── Api.jsx          # Axios configuration (Port 8000)
│   │   ├── pages/
│   │   │   ├── Login.jsx        # Login page
│   │   │   └── Signup.jsx       # Signup page
│   │   └── ...
│   └── vite.config.js           # Vite config (Port 3000)
│
├── backend/
│   └── services/
│       ├── ml_prediction_api.py      # Main FastAPI app (Port 8000)
│       ├── auth_service.py           # Authentication service
│       ├── ml_prediction_service.py  # ML prediction service
│       ├── start_server.py           # Unified startup script
│       ├── test_mongodb_connection.py # Test MongoDB
│       └── test_full_integration.py  # Test full system
│
├── ml_model/
│   ├── models/
│   │   ├── lead_temperature_model.pkl
│   │   └── temperature_model_metadata.json
│   └── train_model.py
│
└── README.md                    # This file
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- MongoDB Atlas account (or local MongoDB)

### Step 1: Environment Setup

Make sure your `.env` file is configured:

```env
# Database Configuration
MONGODB_URI=
DB_NAME=ai_crm_db

# Authentication Configuration
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production-2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# API Configuration
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000
CLIENT_URL=http://localhost:3000
```

### Step 2: Install Dependencies

#### Backend:
```bash
cd backend/services
pip install -r ../../requirements.txt
```

#### Frontend:
```bash
cd frontend
npm install
```

### Step 3: Test MongoDB Connection

```bash
cd backend/services
python test_mongodb_connection.py
```

Expected output:
```
✅ Successfully connected to MongoDB!
📊 Database Info:
   Database: ai_crm_db
   Collections: users, leads
```

### Step 4: Start Backend Server

**Option A - Using batch file (Windows):**
```bash
start_backend_server.bat
```

**Option B - Using Python:**
```bash
cd backend/services
python start_server.py
```

You should see:
```
🚀 Starting AI-Powered CRM Backend Server
✅ Environment configuration OK
✅ MongoDB connection successful
📡 Starting FastAPI server...
   Host: 0.0.0.0
   Port: 8000
   API Docs: http://localhost:8000/docs
```

### Step 5: Start Frontend

**Option A - Using batch file (Windows):**
```bash
start_frontend.bat
```

**Option B - Using npm:**
```bash
cd frontend
npm run dev
```

Frontend will be available at: `http://localhost:3000`

### Step 6: Test Full Integration

Run the comprehensive test suite:

```bash
cd backend/services
python test_full_integration.py
```

This will test:
1. MongoDB Connection
2. Backend API Health
3. User Signup
4. User Login
5. ML Prediction
6. ML Statistics

## 🔄 Complete Workflow

### 1. User Registration Flow

```
User fills signup form
       ↓
Frontend sends POST /auth/signup
       ↓
Backend validates data
       ↓
Password is hashed (bcrypt)
       ↓
User saved to MongoDB 'users' collection
       ↓
JWT token generated
       ↓
Token returned to frontend
       ↓
User logged in automatically
```

### 2. User Login Flow

```
User fills login form
       ↓
Frontend sends POST /auth/login
       ↓
Backend retrieves user from MongoDB
       ↓
Password verified (bcrypt)
       ↓
JWT token generated
       ↓
Token returned to frontend
       ↓
User redirected to dashboard
```

### 3. Lead Processing Flow

```
Lead data submitted
       ↓
Frontend sends POST /predict
       ↓
Backend processes with ML service
       ↓
ML model predicts temperature (Hot/Warm/Cold)
       ↓
Result saved to MongoDB 'leads' collection
       ↓
Prediction returned to frontend
       ↓
Dashboard displays lead with temperature
```

## 📚 API Endpoints

### Authentication Endpoints

#### POST `/auth/signup`
Register a new user

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123",
  "role": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "created_at": "2026-02-11T10:30:00"
  }
}
```

#### POST `/auth/login`
Login a user

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin",
    "created_at": "2026-02-11T10:30:00"
  }
}
```

### ML Prediction Endpoints

#### POST `/predict`
Predict lead temperature

**Request:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1-555-0123",
  "role_position": "Senior Developer",
  "skills": "Python, React, AWS",
  "years_of_experience": 5,
  "expected_salary": 120000,
  "location": "San Francisco"
}
```

**Response:**
```json
{
  "success": true,
  "unique_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "prediction": {
    "predicted_temperature": "Hot",
    "confidence": 0.92,
    "probabilities": {
      "Hot": 0.92,
      "Warm": 0.06,
      "Cold": 0.02
    },
    "model_version": "2026-02-01",
    "prediction_timestamp": "2026-02-11T10:35:00"
  },
  "message": "Lead temperature predicted successfully"
}
```

#### GET `/stats`
Get ML prediction statistics

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_leads": 150,
    "total_predictions": 145,
    "coverage_percentage": 96.7,
    "temperature_distribution": [
      {"_id": "Hot", "count": 45, "avg_confidence": 0.89},
      {"_id": "Warm", "count": 60, "avg_confidence": 0.78},
      {"_id": "Cold", "count": 40, "avg_confidence": 0.85}
    ],
    "last_updated": "2026-02-11T10:40:00"
  }
}
```

#### GET `/leads/temperature/{temperature}`
Get leads by temperature

**Example:** `/leads/temperature/Hot?limit=10`

## 🗄️ MongoDB Collections

### users Collection
```javascript
{
  "_id": ObjectId("..."),
  "name": "John Doe",
  "email": "john@example.com",
  "password": "$2b$12$hashed_password...",  // Bcrypt hash
  "role": "admin",
  "created_at": "2026-02-11T10:30:00",
  "is_active": true
}
```

### leads Collection
```javascript
{
  "_id": ObjectId("..."),
  "unique_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1-555-0123",
  "role_position": "Senior Developer",
  "skills": "Python, React, AWS",
  "years_of_experience": 5,
  "expected_salary": 120000,
  "location": "San Francisco",
  "ml_prediction": {
    "predicted_temperature": "Hot",
    "confidence": 0.92,
    "probabilities": {
      "Hot": 0.92,
      "Warm": 0.06,
      "Cold": 0.02
    },
    "model_version": "2026-02-01",
    "prediction_timestamp": "2026-02-11T10:35:00"
  },
  "processed_at": "2026-02-11T10:35:00",
  "ml_enabled": true
}
```

## 🔧 Troubleshooting

### Backend won't start
1. Check if port 8000 is already in use:
   ```bash
   netstat -ano | findstr :8000
   ```
2. Verify MongoDB connection:
   ```bash
   python backend/services/test_mongodb_connection.py
   ```
3. Check environment variables in `.env`

### Frontend can't connect to backend
1. Ensure backend is running on port 8000
2. Check browser console for CORS errors
3. Verify `Api.jsx` baseURL is `http://localhost:8000`

### MongoDB connection fails
1. Check if MongoDB URI is correct in `.env`
2. Verify IP is whitelisted in MongoDB Atlas
3. Check network connectivity

### ML predictions fail
1. Verify ML model files exist in `ml_model/models/`
2. Check model metadata file is present
3. Run model training if needed:
   ```bash
   cd ml_model
   python train_model.py
   ```

## 🎉 Success Indicators

When everything is working correctly, you should see:

### Backend Console:
```
✅ Auth service initialized successfully
✅ Lead scoring service initialized successfully
✅ Connected to MongoDB
INFO: Uvicorn running on http://0.0.0.0:8000
```

### Frontend:
- Signup page loads at `http://localhost:3000/signup`
- Login page loads at `http://localhost:3000/login`
- No console errors
- User can register and login successfully

### MongoDB:
- `users` collection contains registered users
- `leads` collection contains processed leads with ML predictions
- All fields properly indexed

## 📝 Notes

- **Security**: Change `JWT_SECRET_KEY` in production
- **CORS**: Update `allow_origins` in production for security
- **Database**: Consider adding indexes for better performance
- **ML Model**: Retrain periodically with new data for accuracy
- **Backups**: Set up regular MongoDB backups

## 🆘 Need Help?

1. Check the comprehensive test output:
   ```bash
   python backend/services/test_full_integration.py
   ```

2. Check API documentation:
   ```
   http://localhost:8000/docs
   ```

3. Review logs in the console where backend is running

## 📈 Next Steps

1. ✅ Frontend-Backend connected
2. ✅ MongoDB integrated
3. ✅ Authentication working
4. ✅ ML model integrated
5. 🎯 Add more features (lead management, analytics, etc.)
6. 🎯 Deploy to production

---

**Status**: 🟢 Fully Integrated and Operational
