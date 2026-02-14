# Backend Services - Startup Guide

## 🚀 Quick Start

### Windows Users (Recommended)

**Option 1: Double-click to start**
- From project root: Double-click `START_BACKEND.bat`
- From backend/services: Double-click `start_backend.bat`

**Option 2: PowerShell**
```powershell
cd backend\services
.\start_backend.ps1
```

**Option 3: Python directly**
```bash
cd backend\services
python windows_safe_start.py
```

### Linux/Mac Users

```bash
cd backend/services
python start_backend.py
```

## ⚠️ Troubleshooting "Terminal Hangs"

If your terminal hangs when starting the backend, it's usually due to one of these issues:

### 1. MongoDB Connection Issues
- **Problem**: Service tries to connect to MongoDB but it's unavailable
- **Solution**: The updated code now has 2-second timeouts and won't hang
- Check your `.env` file has correct `MONGODB_URI`

### 2. Using Wrong Host
- **Problem**: Using `0.0.0.0` can cause issues on Windows
- **Solution**: Scripts now use `127.0.0.1` (localhost)

### 3. Import Blocking
- **Problem**: Services load heavy dependencies at import time
- **Solution**: Code now uses lazy loading - services only load when first used

### 4. Missing Dependencies
The startup scripts automatically check and install dependencies:
- fastapi
- uvicorn[standard]
- python-dotenv
- pydantic[email]
- pymongo
- pandas
- scikit-learn
- joblib

## 📊 What's Been Fixed

✅ **MongoDB Connection** - Now has 2-second timeout, won't hang if DB is down  
✅ **Lazy Loading** - ML and Auth services only load when first API call is made  
✅ **Windows Compatibility** - Uses 127.0.0.1, safe UTF-8 encoding  
✅ **Error Handling** - Proper error messages instead of silent hangs  
✅ **Startup Scripts** - Automated dependency checks and installation  

## 🔍 Manual Startup (for debugging)

If you need to debug issues, you can start manually:

```bash
# From backend/services directory
python -m uvicorn ml_prediction_api:app --host 127.0.0.1 --port 8000 --log-level debug
```

## 📝 API Endpoints

Once started, visit:
- **Health Check**: http://localhost:8000/health
- **API Documentation**: http://localhost:8000/docs
- **Predict Lead**: POST http://localhost:8000/predict
- **Get Stats**: GET http://localhost:8000/stats

## 🛠️ Environment Setup

Make sure your `.env` file (in project root) has:

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string
DB_NAME=ai_crm_db

# JWT
JWT_SECRET=your_secret_key
```

## 💡 Tips

1. **First time setup**: The script will auto-install dependencies on first run
2. **Can't connect to MongoDB**: The API will still start, but database features won't work
3. **Port already in use**: Stop other services on port 8000 or change the port in the startup script

## ❓ Still Having Issues?

1. Check Python version: `python --version` (requires 3.8+)
2. Check if port 8000 is free: `netstat -ano | findstr :8000` (Windows)
3. View detailed errors: Check the console output when starting
4. Try running with debug logging to see what's blocking

---

**Last Updated**: February 2026  
**Tested On**: Windows 11, Python 3.10+
