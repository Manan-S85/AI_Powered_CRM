# 🚀 Quick Start Guide - AI-Powered CRM

## ⚡ 3-Step Setup

### Step 1: Verify System
```bash
verify_system.bat
```
This will test MongoDB connection and verify all components.

### Step 2: Start Backend
```bash
start_backend_server.bat
```
Backend will run on **http://localhost:8000**

### Step 3: Start Frontend
```bash
start_frontend.bat
```
Frontend will run on **http://localhost:3000**

## 🎯 What's Working

✅ **Frontend ↔ Backend Connected**
- Frontend: React + Vite (Port 3000)
- Backend: FastAPI (Port 8000)
- API calls configured correctly

✅ **Authentication with MongoDB**
- Signup: Creates user in MongoDB `users` collection
- Login: Authenticates against MongoDB
- JWT tokens for secure sessions
- Passwords hashed with bcrypt

✅ **ML Model Integration**
- Predicts lead temperature (Hot/Warm/Cold)
- Automatically saves leads to MongoDB `leads` collection
- Provides confidence scores and probabilities

✅ **MongoDB Collections**
- `users`: User account data
- `leads`: Lead data with ML predictions

## 📊 Test Your System

### Option 1: Automated Test
```bash
cd backend\services
python test_full_integration.py
```

### Option 2: Manual Test

1. **Test MongoDB**:
```bash
cd backend\services
python test_mongodb_connection.py
```

2. **Start Backend**:
```bash
cd backend\services
python start_server.py
```

3. **Test in Browser**:
- Open: http://localhost:8000/docs
- Try: http://localhost:8000/health

4. **Test Frontend**:
- Open: http://localhost:3000/signup
- Create an account
- Login with created credentials

## 🌐 API Endpoints Ready

- `POST /auth/signup` - Register new user
- `POST /auth/login` - Login user
- `POST /predict` - Predict lead temperature
- `GET /stats` - ML statistics
- `GET /leads/temperature/{Hot|Warm|Cold}` - Get leads by temperature
- `GET /health` - System health check

## 📝 Environment Variables

Your `.env` file should have:
```env
MONGODB_URI=mongodb+srv://...
DB_NAME=ai_crm_db
JWT_SECRET_KEY=your-secret-key
FASTAPI_PORT=8000
CLIENT_URL=http://localhost:3000
```

## 🔍 Troubleshooting

### Backend won't start?
```bash
# Check if port 8000 is free
netstat -ano | findstr :8000

# Test MongoDB
python backend\services\test_mongodb_connection.py
```

### Can't connect to backend?
1. Verify backend is running on port 8000
2. Check browser console for errors
3. Ensure CORS is configured

### MongoDB issues?
1. Check MONGODB_URI in .env
2. Verify IP is whitelisted in MongoDB Atlas
3. Test connection manually

## 📚 Documentation

- **Full Documentation**: See `INTEGRATION_GUIDE.md`
- **API Docs**: http://localhost:8000/docs (when backend running)
- **Error Fixes**: See `backend/ERROR_FIXES_SUMMARY.md`

## 🎮 Usage Flow

1. **Start Backend**: `start_backend_server.bat`
2. **Start Frontend**: `start_frontend.bat`
3. **Open Browser**: http://localhost:3000
4. **Sign Up**: Create admin account
5. **Login**: Use your credentials
6. **Dashboard**: Manage leads with ML predictions

## ✨ Key Features

- 🔐 Secure JWT authentication
- 🗄️ MongoDB data persistence
- 🤖 ML-powered lead scoring
- 📊 Real-time predictions
- 🎨 Modern React UI
- ⚡ Fast FastAPI backend

## 🆘 Quick Commands

```bash
# Test everything
verify_system.bat

# Start backend
start_backend_server.bat

# Start frontend
start_frontend.bat

# Run integration tests
python backend\services\test_full_integration.py

# Test MongoDB
python backend\services\test_mongodb_connection.py
```

## 🎯 Status: READY TO USE ✅

All components are integrated and tested:
- ✅ Frontend-Backend connection
- ✅ MongoDB authentication
- ✅ ML model integration
- ✅ Lead processing and storage

---

**You're all set! Start the system and begin using your AI-Powered CRM!** 🚀
