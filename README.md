# CampusX — AI Student Hub

**CampusX** is a full-stack, SaaS-style AI student productivity platform that unifies Firebase Authentication, a **Voice Study Assistant**, a Google Gemini AI study tutor, a per-user 7-stage PDF Retrieval-Augmented Generation (**RAG**) assistant, a WeatherAPI live weather dashboard, a customizable student portfolio, an interactive prompt engineering MCQ quiz, an AI study planner, and smart notes.

> **Security Architecture:** All private backend secrets (`GEMINI_API_KEY`, `WEATHERAPI_API_KEY`, optional Firebase Service Account credentials) live strictly on the FastAPI backend. Private backend API routes require a verified Firebase ID token (`Authorization: Bearer <token>`), and uploaded PDFs, vector embeddings, and workspace state are isolated per authenticated student UID.

---

## Features

- **Firebase Authentication & Account Isolation (`/login`, `/register`)**:
  - Google Sign-In (`signInWithPopup` with account chooser), Email/Password sign-in, student registration, Forgot Password reset emails, `Remember Me` session persistence, and Sign Out.
  - Private frontend routes redirect unauthenticated users to `/login`; FastAPI verifies Firebase ID tokens on private `/api/*` endpoints and scopes `localStorage` and ChromaDB RAG documents per user UID.
- **Voice Study Assistant (`Voice Study Assistant`)**:
  - Record spoken study requirements (`MediaRecorder`) transcribed via **Google Gemini multimodal audio transcription** (`backend/app/services/stt_service.py`) or edit/paste transcripts manually (English and Hindi supported).
  - Extracts subject, exam date, syllabus chapters, weak topics, and daily study hours via **Google Gemini** (`google-genai`), prompts for any missing details, generates a complete daily study timetable + chapter-wise notes, and syncs them to **Study Planner** and **Smart Notes**.
- **Gemini Student Chatbot (`AI Chatbot`)**:
  - Multi-turn AI tutor powered by **Google GenAI SDK (`google-genai`)** with starter prompts, conversation history, Clear Conversation, and a **Temperature Slider (`0.1` – `1.0`)**.
- **7-Stage Document AI / RAG Assistant (`Document AI / RAG`)**:
  1. **Load**: Extract page-level text from uploaded PDFs with `pypdf`.
  2. **Chunk**: Split text into `750`-character chunks (`150`-char overlap) with page and `user_id` metadata.
  3. **Embed**: Generate normalized embeddings via the **Google Gemini Embedding API** (`gemini-embedding-001`, zero local PyTorch/CUDA models).
  4. **Store**: Persist vectors and metadata in `ChromaDB` (`backend/chroma_db/`).
  5. **Retrieve**: Cosine similarity Top-K retrieval restricted to the authenticated user's uploaded PDFs.
  6. **Generate**: Grounded Gemini answer synthesis with page citations.
  7. **Display**: Answer card + retrieved excerpts with similarity scores, plus an interactive **Workflow Diagram & Business Use Cases** tab.
- **Live Weather Dashboard (`Weather`)**:
  - Powered by **WeatherAPI** (`weatherapi.com`) via FastAPI with backend `WEATHERAPI_API_KEY`, 10-minute server caching & duplicate-request protection, `°C` / `°F` toggle, humidity, wind speed, surface pressure, dynamic condition icons, invalid-city/quota error handling, and WeatherAPI attribution.
- **AI Personal Portfolio (`My Portfolio`)**, **Prompt Eng MCQ Quiz (`MCQ Quiz`)**, **AI Study Planner (`Study Planner`)**, **Smart Notes (`Smart Notes`)**, and **Dark / Light Mode**.

---

## Technology Stack

- **Frontend**: React 18, Vite, JavaScript, Tailwind CSS, Lucide Icons, Firebase Web SDK (`firebase`)
- **Backend**: Python, FastAPI, Uvicorn, Pydantic, HTTPX, Python-Multipart
- **Authentication**: Firebase Authentication (Client SDK) + Google/Firebase ID token verification (`firebase-admin` / `google-auth`)
- **AI, Speech & RAG**: Google GenAI Python SDK (`google-genai` for chat, `gemini-embedding-001` embeddings, and audio transcription), ChromaDB, PyPDF
- **Weather Data**: WeatherAPI (`api.weatherapi.com/v1/current.json`)
- **Deployment Targets**: Separate deployment — **Vercel** (Frontend) + **Render** (Backend)

---

## Project Folder Structure

```text
campusx/
├── frontend/                     # Separate Vite + React frontend root
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   └── TopBar.jsx
│   │   ├── config/
│   │   │   └── firebase.js
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── data/
│   │   │   └── defaultData.js
│   │   ├── pages/
│   │   │   ├── ChatbotPage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── NotesPage.jsx
│   │   │   ├── PortfolioPage.jsx
│   │   │   ├── QuizPage.jsx
│   │   │   ├── RagPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   ├── StudyPlannerPage.jsx
│   │   │   ├── VoiceStudyPage.jsx
│   │   │   └── WeatherPage.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── vercel.json
│   └── vite.config.js
├── backend/                      # Separate FastAPI backend root
│   ├── app/
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   └── firebase_auth.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py
│   │   ├── rag/
│   │   │   ├── __init__.py
│   │   │   └── pipeline.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   ├── health.py
│   │   │   ├── rag.py
│   │   │   ├── voice_study.py
│   │   │   └── weather.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── gemini_service.py
│   │   │   └── stt_service.py
│   │   ├── __init__.py
│   │   ├── config.py
│   │   └── main.py
│   ├── tests/
│   │   └── test_api.py
│   ├── .env.example
│   └── requirements.txt
├── docs/
│   ├── architecture.md
│   ├── bug-report.md
│   ├── rag-workflow.md
│   └── screenshots/
│       └── README.md
├── .gitignore
├── render.yaml
└── README.md
```

---

## Local Setup Instructions

### Prerequisites
- **Node.js** (v18+ recommended) & **npm**
- **Python** (3.11+ recommended)
- A **Google Gemini API key** and a **Firebase project** (Authentication enabled for Email/Password and Google)

### 1. Backend Setup (`backend/`)
```bash
cd backend
python -m venv .venv

# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and configure:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash-lite
WEATHERAPI_API_KEY=your_weatherapi_com_api_key_here
FIREBASE_PROJECT_ID=your_firebase_project_id
# Optional for token-revocation / full Admin SDK features:
# FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Start the FastAPI backend:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Health endpoint: `http://127.0.0.1:8000/api/health`
- API docs: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup (`frontend/`)
```bash
cd frontend
npm install
cp .env.example .env
```

Edit `frontend/.env` with your public Firebase Web App config (`Firebase Console -> Project settings -> Your apps`):
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_web_app_id
```

Start the Vite development server:
```bash
npm run dev -- --host 127.0.0.1 --port 5173
```
Open **`http://127.0.0.1:5173`** (or **`http://localhost:5173`**) in your browser.

### 3. Verification Commands
```bash
# Backend integration & security tests (from backend/):
python -m tests.test_api

# Frontend production build (from frontend/):
npm run build
```

---

## Separate Cloud Deployment Guide

CampusX is structured so the **Frontend** and **FastAPI Backend** deploy as two independent services.

### Quick Reference (Roots & Commands)

| Service | Root Directory | Install / Build Command | Start / Output |
|---|---|---|---|
| **Frontend (Vercel / Static Host)** | `frontend` | `npm install && npm run build` | Output directory: `dist` (SPA rewrites configured in [`frontend/vercel.json`](frontend/vercel.json)) |
| **Backend (Render / Python Host)** | `backend` | `pip install -r requirements.txt` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1` (configured in [`render.yaml`](render.yaml)) |

### Step 1: Deploy Backend on Render
1. Create a **Web Service** on [Render](https://render.com) connected to your GitHub repository (or deploy with `render.yaml` Blueprint).
2. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`
3. Set Environment Variables on Render:
   - `GEMINI_API_KEY` — your Gemini API key
   - `GEMINI_MODEL` — `gemini-3.5-flash-lite`
   - `WEATHERAPI_API_KEY` — your backend-only key from [weatherapi.com](https://www.weatherapi.com/)
   - `EMBEDDING_MODEL` — `gemini-embedding-001`
   - `FIREBASE_PROJECT_ID` — your Firebase project ID
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — *(optional)* minified Firebase service account JSON string
   - `CORS_ORIGINS` — your deployed frontend URL (e.g. `https://campusx.vercel.app`)

### Step 2: Deploy Frontend on Vercel
1. Import your GitHub repository on [Vercel](https://vercel.com).
2. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Set Environment Variables on Vercel:
   - `VITE_API_BASE_URL` — `https://campusx-w5tq.onrender.com` (no trailing slash)
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

### Step 3: Post-Deploy Wiring
1. Update `CORS_ORIGINS` in Render to match your exact live Vercel URL (`https://...vercel.app`).
2. In **Firebase Console → Authentication → Settings → Authorized domains**, add your live Vercel domain so Google Sign-In works in production.

---

## Architecture & Docs

- System Architecture: [`docs/architecture.md`](docs/architecture.md)
- RAG Workflow & Use Cases: [`docs/rag-workflow.md`](docs/rag-workflow.md)
- Bug Report & Verification Log: [`docs/bug-report.md`](docs/bug-report.md)
- Screenshots Checklist: [`docs/screenshots/README.md`](docs/screenshots/README.md)

---

## Known Limitations

- **Gemini API Key Required**: AI Chatbot, RAG embeddings (`gemini-embedding-001`), RAG answer generation, and Voice Study audio transcription all use `GEMINI_API_KEY` on the backend.
- **Ephemeral Free-Tier Disk**: Hosting providers with ephemeral filesystems (such as Render free tier) reset `chroma_db/` on redeploy unless a persistent disk is attached.
- **Text-Based PDFs Only**: `pypdf` extracts selectable text layers; scanned image-only PDFs require OCR beforehand.
