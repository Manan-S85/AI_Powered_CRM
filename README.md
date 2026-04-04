# AI Powered CRM

Enterprise-ready CRM platform with AI-assisted lead intelligence, ML-driven scoring, conversational operations, and advanced sales analytics.

This repository contains:
- React + Vite frontend with a collapsible left-sidebar application shell.
- FastAPI backend for authentication, lead lifecycle, AI workflows, and analytics.
- ML assets and training scripts for lead temperature classification.
- Utility services for enrichment, follow-up optimization, forecasting, chatbot tool routing, and optional Google Sheets sync.

## 1. Product Overview

The system is designed around a lead intelligence lifecycle:
1. Capture or ingest lead data.
2. Score leads (Hot/Warm/Cold) with ML.
3. Operate on leads via dashboards, profile pages, and AI workflows.
4. Generate sales insights from conversation artifacts.
5. Optimize follow-up timing/channel.
6. Forecast revenue and closure trends.
7. Predict Client Lifetime Value (CLV) signals for expansion planning.
8. Use chatbot tooling for natural-language CRM operations.

## 2. Current Architecture

```text
Frontend (React/Vite, port 3000)
		|
		| HTTP JSON / multipart
		v
Backend API (FastAPI, port 8000)
		|
		+--> MongoDB (users, leads, ai_insights)
		+--> ML model artifacts (lead temperature model)
		+--> LLM providers (Gemini/OpenAI/Groq/Anthropic) for AI features
		+--> Optional Google Sheets sync utilities
```

Primary backend entrypoint: `backend/services/main.py`.

## 3. Repository Structure (Key Paths)

```text
AI_Powered_CRM/
├── app.py                                    # Legacy Flask entrypoint (not primary runtime)
├── backend/
│   ├── requirements.txt
│   ├── setup.py
│   └── services/
│       ├── main.py                           # Primary FastAPI app
│       ├── auth_service.py                   # MongoDB-backed auth
│       ├── auth_service_inmemory.py          # Dev fallback auth
│       ├── ml_prediction_service.py          # Lead scoring + lead storage/retrieval
│       ├── email_generator.py                # Smart follow-up email generator
│       ├── mongo_to_sheets.py                # MongoDB -> Google Sheets sync utility
│       ├── start_crm_services.py             # Combined API + scheduler runner
│       ├── chatbot/
│       │   ├── chatbot_controller.py         # Tool-routing orchestrator
│       │   ├── gemini_client.py              # Gemini routing + fallback behavior
│       │   ├── tool_schema.py                # Tool contracts
│       │   └── tools/                        # get_leads/add_lead/get_stats/enrichment handlers
│       ├── followup_service/
│       │   ├── router.py                     # /followup/optimize
│       │   ├── data_processor.py
│       │   ├── pattern_analyzer.py
│       │   └── ai_recommender.py
│       ├── client_ltv/
│       │   ├── router.py                     # /clv/predict
│       │   └── predictor.py
│       ├── sales_forecasting/
│       │   └── forecast_service.py
│       ├── smart lead summary/
│       │   └── ai_insights_service.py        # Stores AI insights in MongoDB
│       └── lead data enrichment/
│           ├── ai_processor.py
│           ├── domain_extractor.py
│           └── website_scraper.py
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                           # Route registration + sidebar shell
│       ├── api/Api.jsx                       # Axios base URL + interceptors
│       ├── components/
│       │   ├── Navbar.jsx                    # Collapsible left sidebar shell
│       │   └── SmartEmailGeneratorModal.jsx
│       ├── pages/                            # Feature pages
│       └── services/                         # feature-specific API clients
├── ml_model/
│   ├── train_model.py
│   ├── models/
│   │   ├── lead_temperature_model.pkl
│   │   └── temperature_model_metadata.json
│   └── data/
├── INTEGRATION_GUIDE.md
└── requirements.txt
```

## 4. Tech Stack

### Frontend
- React 18
- React Router
- Axios
- Tailwind CSS
- Chart.js + react-chartjs-2
- Lucide icons
- Vite

### Backend
- FastAPI + Uvicorn
- Pydantic
- PyMongo / Motor (dependencies include both sync and async tooling)
- scikit-learn, pandas, scipy, joblib
- python-dotenv
- Requests + HTTPX

### Data / AI
- MongoDB (`users`, `leads`, `ai_insights`)
- Lead temperature classifier model in `ml_model/models`
- LLM providers: Gemini / OpenAI / Groq / Anthropic

## 5. Runtime Requirements

- Python 3.10+ recommended
- Node.js 18+ recommended
- npm 9+
- MongoDB Atlas or local MongoDB instance

## 6. Environment Variables

Create a root `.env` in repository root (`AI_Powered_CRM/.env`).

### Required for core backend

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MONGODB_URI` | Yes (unless `SKIP_MONGODB=true`) | none | MongoDB connection string |
| `DB_NAME` | No | `ai_crm_db` | MongoDB database name |
| `JWT_SECRET_KEY` | Yes for production | fallback insecure value in code | JWT signing key for auth |

### Mongo connection tuning

| Variable | Required | Default |
| --- | --- | --- |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS` | No | `5000` or `7000` depending on module |
| `MONGO_CONNECT_TIMEOUT_MS` | No | `5000` or `7000` |
| `MONGO_SOCKET_TIMEOUT_MS` | No | `10000` or `12000` |
| `MONGO_MAX_POOL_SIZE` | No | `10` |

### Auth / dev fallback

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SKIP_MONGODB` | No | `false` | Use in-memory auth fallback for local dev |

### LLM and chatbot / smart email

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `LLM_PROVIDER` | No | auto-resolved | Preferred provider (`gemini`, `openai`, `groq`, `anthropic`) |
| `LLM_API_KEY` | No | none | Generic key override |
| `LLM_MODEL` | No | provider default | Generic model override |
| `GEMINI_API_KEY` | Optional | none | Gemini provider key |
| `GOOGLE_API_KEY` | Optional | none | Gemini alternate key |
| `GEMINI_MODEL` | No | fallback chain | Gemini model override |
| `GEMINI_TIMEOUT_SECONDS` | No | `30` | Chatbot Gemini timeout |
| `OPENAI_API_KEY` | Optional | none | OpenAI key |
| `OPENAI_LLM_MODEL` | No | `gpt-4o-mini` | AI insights LLM model |
| `OPENAI_WHISPER_MODEL` | No | `whisper-1` | Audio transcription model |
| `GROQ_API_KEY` | Optional | none | Groq key |
| `ANTHROPIC_API_KEY` | Optional | none | Anthropic key |

### Google Sheets sync utility (optional)

| Variable | Required | Default |
| --- | --- | --- |
| `GOOGLE_SPREADSHEET_NAME` | No | `CRM form (Responses)` |
| `GOOGLE_WORKSHEET_NAME` | No | `Form Responses 1` |
| `MONGODB_COLLECTION_NAME` | No | `leads` |

## 7. Installation and Startup

### 7.1 Clone and create virtual environment (Windows PowerShell)

```powershell
git clone <your-repo-url>
cd "AI_Powered_CRM"
python -m venv .venv
& ".\.venv\Scripts\Activate.ps1"
```

### 7.2 Install Python dependencies

```powershell
pip install -r requirements.txt
pip install -r .\backend\requirements.txt
```

### 7.3 Install frontend dependencies

```powershell
cd .\frontend
npm install
cd ..
```

### 7.4 Start backend (primary API)

```powershell
cd .\backend\services
python main.py
```

API docs: `http://localhost:8000/docs`

### 7.5 Start frontend

```powershell
cd .\frontend
npm run dev
```

Frontend: `http://localhost:3000`

### 7.6 Optional: start API + periodic scheduler together

```powershell
cd .\backend\services
python start_crm_services.py
```

## 8. Frontend Routes and Feature Mapping

Protected app routes are defined in `frontend/src/App.jsx`.

| Route | Page | Primary backend calls |
| --- | --- | --- |
| `/dashboard` | Dashboard | `GET /leads?limit=50` |
| `/addleads` | Add Lead | `POST /predict` |
| `/mlstats` | ML Stats | `GET /stats`, `GET /model/info` |
| `/ai-insights` | AI Insights | `POST /ai-insights/generate` |
| `/sales-forecasting` | Sales Forecasting | `GET /sales-forecast` |
| `/client-ltv` | CLV Prediction | `GET /leads`, `POST /clv/predict` |
| `/followup-optimizer` | Follow-up Optimizer | `GET /leads`, `POST /followup/optimize` |
| `/chatbot` | Chatbot | `POST /chatbot/chat` |
| `/candidate/:candidate_id` | Candidate Profile | `GET /candidate/{id}`, `POST /lead-enrichment/enrich-company`, `POST /email/generate-followup` |
| `/lead/:id` | Lead Detail | `GET /lead/{id}`, `POST /email/generate-followup` |
| `/lead/edit/:id` | Edit Lead | Uses direct `fetch` to `http://localhost:8001/lead/{id}` |
| `/profile` | Profile | localStorage update + `userUpdated` event |

Public routes:
- `/login`
- `/signup`

## 9. Feature-by-Feature Behavior

### 9.1 Authentication (Admin-only)

Frontend pages:
- `frontend/src/pages/Login.jsx`
- `frontend/src/pages/Signup.jsx`

Backend endpoints:
- `POST /auth/signup` (also legacy `POST /api/auth/signup`)
- `POST /auth/login` (also legacy `POST /api/auth/login`)

How it works:
1. Signup/login posts user credentials to FastAPI.
2. Backend validates role as admin.
3. Password is hashed with PBKDF2-HMAC in auth service.
4. JWT token returned to frontend.
5. Frontend stores token/user/role in localStorage.

### 9.2 Add Lead + ML Temperature Prediction

Frontend page:
- `frontend/src/pages/AddLead.jsx`

Backend endpoint:
- `POST /predict`

How it works:
1. Form captures candidate + optional company fields.
2. Frontend normalizes optional empty strings to `null` and numeric fields to numbers.
3. Backend validates payload using `LeadInput`.
4. `ml_prediction_service` maps incoming schema to model features.
5. Model predicts temperature (`Hot`, `Warm`, `Cold`) and confidence.
6. Lead stored/updated in MongoDB `leads` collection with `unique_id` and `ml_prediction`.

### 9.3 Dashboard Lead Intelligence

Frontend page:
- `frontend/src/pages/Dashboard.jsx`

Backend endpoint:
- `GET /leads?limit=50`

How it works:
1. Fetches most recent leads from MongoDB.
2. Frontend normalizes mixed key naming from historical records.
3. Displays total leads, hot leads, and average confidence.
4. Table action navigates to candidate profile route.

### 9.4 Candidate Profile and Company Enrichment

Frontend page:
- `frontend/src/pages/CandidateProfile.jsx`

Backend endpoints:
- `GET /candidate/{candidate_id}`
- `POST /lead-enrichment/enrich-company`

How it works:
1. Candidate is loaded by `unique_id` (fallback to Mongo `_id`).
2. User edits company fields client-side.
3. Enrichment endpoint extracts domain, scrapes website content (if provided), and generates intelligence summary.
4. Intelligence panel shows industry, size estimate, decision makers, summary.

### 9.5 Smart Follow-up Email Generation

Frontend components/pages:
- `frontend/src/components/SmartEmailGeneratorModal.jsx`
- Used in candidate and lead detail pages

Backend endpoint:
- `POST /email/generate-followup`

How it works:
1. Modal sends `unique_id`, `deal_stage`, and `past_communication`.
2. Backend fetches lead details from ML service.
3. Prompt is generated using lead profile + lead temperature + deal context.
4. LLM provider is auto-selected from environment.
5. Response is parsed into `subject` + `body` and returned.

### 9.6 AI Insights from Transcript/Chat/Notes

Frontend page:
- `frontend/src/pages/AIInsights.jsx`

Backend endpoint:
- `POST /ai-insights/generate` (multipart)

How it works:
1. User submits source type, optional text, optional file.
2. For call transcripts, supported audio files can be transcribed via Whisper.
3. Structured JSON is generated by LLM with strict schema.
4. Output is sanitized and stored in MongoDB `ai_insights` collection.
5. UI renders pain points, budget probability, urgency, next action, follow-up timeline.

### 9.7 ML Stats Dashboard

Frontend page:
- `frontend/src/pages/MlStateSample.jsx`

Backend endpoints:
- `GET /stats`
- `GET /model/info`

How it works:
1. Stats aggregation reads ML predictions from MongoDB.
2. Distribution and confidence metrics are visualized with charts.
3. Model metadata is shown (accuracy, feature count, training date).

### 9.8 Sales Forecasting

Frontend page:
- `frontend/src/pages/SalesForecasting.jsx`

Backend endpoint:
- `GET /sales-forecast?months=&limit=`

How it works:
1. Pulls leads from MongoDB and builds month-level revenue/closure series.
2. Computes pipeline health, close rate, trend direction, projected next month revenue.
3. Returns founder-facing recommendation text.

### 9.9 Follow-up Optimization

Frontend page:
- `frontend/src/pages/FollowupOptimizer.jsx`

Backend endpoint:
- `POST /followup/optimize`

How it works:
1. User selects a lead and submits interaction history (`sent_time`, optional `reply_time`, `channel`).
2. Data processor validates and normalizes temporal records.
3. Pattern analyzer computes response trends and reliability.
4. Recommender returns best day/time/channel with confidence and reason.

### 9.10 Client Lifetime Value (CLV) Prediction

Frontend page:
- `frontend/src/pages/ClientLtvPrediction.jsx`

Backend endpoint:
- `POST /clv/predict`

How it works:
1. User selects existing customer ID or inputs sample values.
2. Backend validates behavior features and predicts CLV.
3. Uses tuned model if available; otherwise uses deterministic rule-based fallback.
4. Returns CLV, upsell band, and cross-sell timing window.

### 9.11 Chatbot Tool Routing

Frontend page:
- `frontend/src/pages/Chatbot.jsx`

Backend endpoint:
- `POST /chatbot/chat`

Supported tool intents (from `backend/services/chatbot/tool_schema.py`):
- `get_leads`
- `add_lead`
- `analyze_conversation`
- `enrich_company`
- `get_stats`
- `general_assistant`

How it works:
1. User prompt + `user_context` sent to chatbot endpoint.
2. Gemini tool router predicts `{ tool, arguments }` JSON.
3. Arguments are validated and normalized server-side.
4. Handler executes one tool and returns structured output + human-readable message.
5. Conversation memory is persisted in frontend localStorage and reused in later prompts.

## 10. Backend API Reference

Base URL: `http://localhost:8000`

### 10.1 Core and health
- `GET /`
- `GET /health`

### 10.2 Auth
- `POST /auth/signup`
- `POST /auth/login`
- Legacy aliases: `POST /api/auth/signup`, `POST /api/auth/login`

### 10.3 Lead operations
- `POST /predict`
- `GET /lead/{unique_id}`
- `GET /candidate/{candidate_id}`
- `GET /leads`
- `GET /leads/temperature/{temperature}`
- `GET /leads/hot`
- `GET /leads/warm`
- `GET /leads/cold`
- `POST /batch-predict`

### 10.4 Analytics and AI
- `GET /stats`
- `GET /model/info`
- `GET /sales-forecast`
- `POST /ai-insights/generate`
- `POST /lead-enrichment/enrich-company`
- `POST /followup/optimize`
- `POST /clv/predict`
- `POST /email/generate-followup`
- `POST /chatbot/chat`

## 11. Important Request Contracts

### 11.1 `/predict` example

```json
{
	"name": "Aarav Mehta",
	"email": "aarav@example.com",
	"role_position": "Data Engineer",
	"years_of_experience": 4,
	"skills": "Python, Spark, SQL",
	"location": "Bengaluru",
	"expected_salary": 1800000,
	"willing_to_relocate": "Yes"
}
```

### 11.2 `/ai-insights/generate` multipart fields

- `source_type` (required): `call_transcript` | `whatsapp_chat` | `meeting_notes`
- `conversation_text` (optional)
- `file` (optional)

### 11.3 `/followup/optimize` example

```json
{
	"lead_id": "LEAD_001",
	"interactions": [
		{
			"sent_time": "2026-03-20T10:00:00",
			"reply_time": "2026-03-20T14:30:00",
			"channel": "email"
		}
	]
}
```

### 11.4 `/clv/predict` example

```json
{
	"customer_id": "LEAD_001",
	"industry_type": "saas",
	"engagement_level": "high",
	"purchase_behavior": {
		"recency_days": 15,
		"orders_last_12_months": 20,
		"avg_order_value": 1600,
		"unique_products_purchased": 12,
		"customer_lifetime_days": 540,
		"avg_days_between_orders": 18,
		"items_per_order": 3,
		"total_spend_last_12_months": 38000
	}
}
```

### 11.5 `/chatbot/chat` example

```json
{
	"user_input": "Show high probability leads from last 30 days",
	"user_context": {}
}
```

## 12. Frontend Integration Notes

- Axios base URL is `http://localhost:8000` (`frontend/src/api/Api.jsx`).
- Frontend dev server is configured for port `3000` (`frontend/vite.config.js`).
- Sidebar shell is collapsible and implemented in `frontend/src/components/Navbar.jsx`.
- Auth route convention is `/auth/*` (without `/api` prefix); `/api/auth/*` exists only as legacy alias.

## 13. Data Persistence Summary

### MongoDB collections used
- `users`: admin accounts
- `leads`: lead records + ML predictions + metadata
- `ai_insights`: generated conversation intelligence

### Lead identity behavior
- Unique lead ID (`unique_id`) is deterministic from identifying fields where possible.
- Existing leads are updated if same `unique_id` is found.

## 14. Legacy and Compatibility Notes

- `app.py` at repository root is a legacy Flask service and not the primary runtime path.
- `frontend/src/pages/EditLead.jsx` currently uses direct `fetch` to `http://localhost:8001/lead/{id}` and does not use the shared Axios client on port 8000.
- Both modern and older folder variants exist for some services (for example, spaced folder names). Current runtime paths are wired in `backend/services/main.py`.

## 15. Development and Validation Commands

### Frontend

```powershell
cd .\frontend
npm run dev
npm run build
npm run lint
```

### Backend

```powershell
cd .\backend\services
python main.py
```

### ML training (optional)

```powershell
cd .\ml_model
python train_model.py
```

## 16. Troubleshooting

### 16.1 Backend starts but auth fails
- Verify `MONGODB_URI` and database network access.
- Check if `SKIP_MONGODB` is unintentionally set.

### 16.2 Chatbot fails with provider errors
- Verify `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
- Check `GEMINI_MODEL` override and quota.

### 16.3 Smart email generator returns placeholder
- No LLM key was resolved.
- Set one of: `LLM_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`.

### 16.4 AI Insights audio transcription fails
- Ensure `OPENAI_API_KEY` is set.
- Confirm uploaded file extension is supported for call transcripts.

### 16.5 Frontend route works but API call fails
- Confirm backend is on `http://localhost:8000`.
- Review browser console and backend logs.
- For edit page specifically, confirm service availability on `http://localhost:8001`.

## 17. Security Notes

- Replace `JWT_SECRET_KEY` in all non-local environments.
- Restrict CORS origins in production (`allow_origins` is currently permissive).
- Do not commit `.env` or cloud credentials.
- Rotate provider API keys and enforce least-privilege access.

## 18. License

MIT License. See `LICENSE`.