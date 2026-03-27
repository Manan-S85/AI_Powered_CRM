# AI-Powered CRM System

A complete Customer Relationship Management system with AI-powered lead scoring and automated data pipeline.

## 🔄 Data Flow

```
Google Forms → Google Sheets → FastAPI Backend → MongoDB → ML Model → Lead Scoring → Frontend Dashboard
```

## 🚀 Features

- **Automated Lead Collection**: Google Forms responses automatically sync to database
- **AI Lead Scoring**: Machine learning models classify and score leads
- **Real-time Dashboard**: Modern frontend for lead management
- **RESTful API**: FastAPI backend with async operations
- **MongoDB Integration**: Flexible NoSQL database for lead data
- **Google Sheets Sync**: Automatic data synchronization

## 📁 Project Structure

```
AI_Powered_CRM/
├── backend/                 # FastAPI backend
│   ├── fastapi_server.py   # Main FastAPI application
│   ├── start_fastapi.py    # Server startup script
│   ├── predictor.py        # ML model integration
│   ├── requirements.txt    # Python dependencies
│   └── services/           # Service modules
│       ├── google_sheets_service.py
│       ├── mongodb_service.py
│       └── ml_service.py
├── ml_model/               # Machine learning components
│   ├── train_model.py      # Model training script
│   ├── generate_dataset.py # Dataset generation
│   └── data/               # Training data
├── frontend/               # React/Vue frontend (future)
└── google_forms/           # Google Forms integration
```

## 🛠 Setup Instructions

### 1. Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd AI_Powered_CRM
```

2. Create `.env` file (copy from `.env.example`):
```bash
# Database Configuration
MONGODB_URI=your-mongodb-connection-string
DB_NAME=ai_crm_db

# Google Sheets Integration
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./config/google-service-account.json
GOOGLE_SHEETS_ID=your-google-sheets-id
GOOGLE_SHEETS_RANGE=Sheet1!A:Z

# FastAPI Configuration
FASTAPI_HOST=0.0.0.0
FASTAPI_PORT=8000

# Frontend
CLIENT_URL=http://localhost:3000
```

### 2. Backend Setup

1. Install Python dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Start the FastAPI server:
```bash
python start_fastapi.py
```

The backend will run on: `http://localhost:8000`

### 3. Google Sheets Integration

1. Create a Google Cloud Project
2. Enable Google Sheets API
3. Create a Service Account and download JSON credentials
4. Place credentials at `backend/config/google-service-account.json`
5. Share your Google Sheet with the service account email

### 4. Database Setup

The application uses MongoDB. You can use:
- **MongoDB Atlas** (cloud) - recommended
- **Local MongoDB** installation

Update the `MONGODB_URI` in your `.env` file accordingly.

## 📊 API Endpoints

### Pipeline Operations
- `POST /api/pipeline/sync-sheets` - Sync Google Sheets data
- `POST /api/pipeline/process-leads` - Process leads through ML
- `POST /api/pipeline/full-pipeline` - Complete pipeline execution
- `GET /api/pipeline/status` - Pipeline status and statistics

### Lead Management
- `GET /api/leads` - Get processed leads for dashboard
- `POST /api/leads` - Create new lead manually

### Health Check
- `GET /` - API status and information

## 🤖 Machine Learning

The system includes:
- **Lead Classification**: Categorizes leads as hot, warm, cold, etc.
- **Lead Scoring**: Assigns numerical scores (0-100) based on various factors
- **Feature Engineering**: Processes form responses for ML input
- **Model Training**: Scripts to retrain models with new data

## 🔧 Development

### Running Tests
```bash
cd backend
python -m pytest
```

### Code Quality
```bash
# Format code
black .

# Lint code
flake8 .
```

## 📈 Monitoring

- View logs in the backend console
- Monitor pipeline status via API endpoints
- Check MongoDB for data integrity

## 🚀 Deployment

### Production Checklist
- [ ] Set secure environment variables
- [ ] Configure production database
- [ ] Set up proper logging
- [ ] Enable HTTPS
- [ ] Configure domain and DNS
- [ ] Set up monitoring

### Docker Deployment (Future)
```bash
# Build and run with Docker Compose
docker-compose up --build
```

## 🔒 Security

- Environment variables are not committed to version control
- Google service account credentials are gitignored
- Database connections use secure protocols
- API endpoints include proper error handling

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the API documentation at `http://localhost:8000/docs`
- Review logs for troubleshooting