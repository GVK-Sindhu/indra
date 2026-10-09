# INDRA — AI-Powered Industrial Knowledge Intelligence Platform

INDRA is an AI-powered Industrial Knowledge Intelligence platform that makes heterogeneous industrial specifications queryable, actionable, and continuously validated. It features an Active Knowledge Reliability & Decision Guardrail Engine.

This project runs **entirely without Docker** directly on your local system.

---

## Architecture Stack

* **Frontend**: React + Vite + TypeScript + TailwindCSS
* **Backend**: Python FastAPI + PyMongo + PyMuPDF + PyTesseract (Fallback OCR)
* **Vector Store**: Local Persistent ChromaDB
* **Main Database**: MongoDB (Local or Remote)
* **LLM Coprocessor**: Gemini 2.5 Flash API via Google GenAI SDK

---

## System Requirements

1. **Node.js**: Version 18 or later.
2. **Python**: Version 3.10 or 3.11.
3. **MongoDB**: Local community server running on port `27017` or a MongoDB Atlas URI connection string.
4. **Tesseract OCR**:
   * **Windows**: Install Tesseract OCR from [UB-Mannheim](https://github.com/UB-Mannheim/tesseract/wiki). Ensure it is installed at the default path `C:\Program Files\Tesseract-OCR\tesseract.exe`.
   * **macOS**: Install via brew: `brew install tesseract`.
   * **Linux**: Install via apt: `sudo apt-get install -y tesseract-ocr`.

---

## Development Setup

### 1. Environment Configuration

Create a `.env` file in the root workspace folder with the following configuration:

```env
# Gemini API credentials
GEMINI_API_KEY=your_gemini_api_key_here

# Local Server Configuration
PORT=5000
SEED_DB=true

# Databases Connection Configurations
MONGODB_URI=mongodb://localhost:27017/indra_db
CHROMA_DB_PATH=./chroma_db
```

### 2. Backend Installation & Run

1. Navigate to the backend directory:
   ```bash
   cd apps/backend-python
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows PowerShell:
   .venv\Scripts\Activate.ps1
   # macOS/Linux:
   source .venv/bin/activate
   ```
3. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
   ```
   *The backend will automatically seed default assets, users, and checklists during the first run if `SEED_DB=true` is enabled.*

### 3. Frontend Installation & Run

1. Navigate to the frontend directory:
   ```bash
   cd apps/frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.
   * Vite automatically proxies `/api` calls to the Python backend running at `http://localhost:5000`.

---

## Seed Accounts

The seeder automatically inserts these test user credentials:

* **Engineer Workspace**:
  * Email: `engineer@indra.ai`
  * Password: `engineer123`
* **Manager Workspace**:
  * Email: `manager@indra.ai`
  * Password: `manager123`
* **Admin Workspace**:
  * Email: `admin@indra.ai`
  * Password: `
  `
