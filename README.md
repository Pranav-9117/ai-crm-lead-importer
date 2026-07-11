# AI CRM Lead Importer — Setup & Installation Guide

An enterprise-grade, type-safe fullstack AI-powered lead ingestion platform designed to intelligently parse, normalize, and import `.csv` CRM lead files (up to 5 MB) into a structured CRM schema.

---

## 📋 System Prerequisites

Before setting up the project, ensure your local or container environment meets the following baseline requirements:

- **Node.js**: `v20.x` or higher (Recommended: LTS `v20.18.0+`)
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: `v24.x+` *(Only required if deploying via Option A: Docker Compose)*
- **OpenAI API Key**: A valid OpenAI secret key (`OPENAI_API_KEY`) with access to `gpt-4.1-mini` (or `gpt-4o-mini`).

---

## 🚀 Setup Option A: Quickstart via Docker Compose (Recommended)

Docker Compose orchestrates both the backend Node.js/Express API server and the frontend Next.js web application inside multi-stage containers without requiring local Node module installations.

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ai-crm-lead-importer
```

### 2. Configure Environment Variables
Copy the provided environment template to initialize your configuration:
```bash
cp backend/.env.example backend/.env
```

Open `./backend/.env` using your preferred editor (`nano`, `code`, or `vim`) and insert your valid `OPENAI_API_KEY`:
```env
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
OPENAI_MODEL=gpt-4.1-mini
AI_BATCH_SIZE=50
MAX_BATCH_RETRIES=3
PORT=3001
NODE_ENV=production
```

### 3. Build & Launch Containers
Build and start the services in detached mode:
```bash
docker-compose up --build -d
```
*Note: Initial compilation of the Next.js production container takes approximately 60–90 seconds depending on system hardware.*

### 4. Access the Applications
Once the containers are healthy and running, open your web browser:
- **Frontend Web Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API Health Check**: [http://localhost:3001/api/health](http://localhost:3001/api/health)

### 5. Managing Container Operations
```bash
# View live streaming container logs
docker-compose logs -f

# Gracefully shut down all containers and remove virtual networks
docker-compose down
```

---

## 💻 Setup Option B: Local Development (`npm run dev`)

To develop locally, debug code, or run automated verification tests directly on your host machine, set up the backend and frontend independently:

### Step 1: Configure & Start the Backend API Server (`PORT=3001`)

1. Open your terminal and navigate into the `backend` workspace:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Initialize the environment variables file:
   ```bash
   cp .env.example .env
   ```
   *Make sure `OPENAI_API_KEY` inside `backend/.env` is set to your actual secret key.*
4. Launch the local development server (with hot-reloading enabled):
   ```bash
   npm run dev
   ```
5. Verify the backend is listening on port `3001`:
   ```bash
   curl http://localhost:3001/api/health
   ```

### Step 2: Configure & Start the Frontend Web Application (`PORT=3000`)

1. Open a **separate terminal window** and navigate to the `frontend` workspace:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Launch the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open your web browser and navigate to [http://localhost:3000](http://localhost:3000) to access the interactive CSV uploader.

---

## 🧪 Verifying Your Setup & Running Tests

Once setup is complete, you can run the automated verification suite to verify domain validation rules, AI extraction accuracy, and batch fault tolerance.

### Run Automated Unit & Integration Tests (`Vitest`)
From the `backend` directory, run:
```bash
cd backend
npm test
```
This executes **44 tests** covering:
- AI schema extraction & enum assignment (`aiExtraction.test.ts`)
- Domain normalization & skip logic (`aiValidation.test.ts`)
- Batch processing concurrency & retry isolation (`batchProcessor.test.ts`)

### Run Strict Type Checking
To confirm type safety across both applications:
```bash
# Verify backend type contracts
cd backend && npm run type-check

# Verify frontend type contracts
cd frontend && npm run type-check
```

---

## 🛠️ Environment Variables Reference (`backend/.env`)

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `OPENAI_API_KEY` | *(Required)* | Your secret OpenAI API key (`sk-...`). Required for AI-powered lead extraction and field mapping. |
| `OPENAI_MODEL` | `gpt-4.1-mini` | The target OpenAI chat completion model invoked by the extraction engine. |
| `AI_BATCH_SIZE` | `50` | Maximum number of CSV records included in a single LLM prompt payload during batch ingestion. |
| `MAX_BATCH_RETRIES` | `3` | Maximum retry attempts for failed AI batches before isolating the batch into error summaries. |
| `PORT` | `3001` | Port where the backend Express API server listens for incoming HTTP requests. |
| `NODE_ENV` | `development` | Runtime environment mode (`development` / `production`). |

---

## 💡 Troubleshooting & Common Setup Issues

- **Port Conflicts (`EADDRINUSE: port 3000 or 3001 already in use`)**:
  If another process is occupying the required ports, terminate the conflicting process:
  ```bash
  # Windows (PowerShell)
  netstat -ano | findstr :3001
  taskkill /PID <PID> /F

  # macOS / Linux
  lsof -i :3001
  kill -9 <PID>
  ```
- **Invalid File Format or Size Errors During Upload**:
  The application strictly accepts **only `.csv` files** up to **5 MB** (`≤ 5MB`). Ensure uploaded files have the `.csv` extension and do not exceed the 5 MB limit.
- **OpenAI API Key Errors (`401 Unauthorized` or `500 Server Error`)**:
  Verify that your `OPENAI_API_KEY` inside `backend/.env` is valid, has no leading/trailing whitespace, and is connected to an active OpenAI account with available billing credit/quota.
