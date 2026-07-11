# Infrastructure SPEC-0008: Deployment, Configuration & CI/CD Management

## Metadata

| Field | Value |
| :--- | :--- |
| **SPEC ID** | `SPEC-0008` |
| **Title** | Production Deployment, CORS Security Configuration & DevOps Pipelines |
| **Layer** | DevOps / Infrastructure |
| **Status** | Implementation-Ready |
| **Authors** | Principal Software Architect |
| **Reviewers** | Senior DevOps, SRE & Platform Engineering Teams |
| **Dependencies** | Depends on all MVP SPECs (`SPEC-0001` through `SPEC-0007`) |

---

## Summary

This specification defines the production hosting infrastructure, environment variable matrix, Cross-Origin Resource Sharing (CORS) security policy, containerization (`Docker`), continuous integration (`GitHub Actions`), and developer onboarding (`README.md`) for the **AI-Powered CRM CSV Importer**. To satisfy project deployment and evaluation requirements within the $\sim 2\text{-day}$ submission window, `SPEC-0008` establishes a zero-cost, high-reliability cloud topology: deploying the Next.js frontend client to **Vercel** and the Express TypeScript backend to **Render** (or **Railway**). It also provides multi-stage Dockerfiles for self-hosted container environments and defines the mandatory GitHub repository layout required for final submission evaluation.

---

## Motivation

Deploying two independent applications (`frontend/` + `backend/`) across distinct cloud hosting platforms frequently introduces CORS failures (`No 'Access-Control-Allow-Origin' header is present`) and environment variable misconfigurations. By standardizing independent build pipelines (`render.yaml`, `vercel.json`), defining strict CORS policies, and automating TypeScript type checking via GitHub Actions before deployment, we guarantee zero deployment regressions and instant reproducibility for evaluators.

### Goals

- Configure **Vercel** deployment for the Next.js `frontend/` package, injecting `NEXT_PUBLIC_API_URL` pointing to the hosted Express service.
- Configure **Render** (or **Railway**) deployment for the Node.js/Express `backend/` package (`render.yaml`), configuring Node 20+ runtime and zero-downtime health checks (`GET /health`).
- Implement strict CORS middleware (`backend/src/middlewares/cors.middleware.ts`) restricting API access to explicit frontend origins (`FRONTEND_URL` + localhost dev).
- Provide multi-stage production `Dockerfile` definitions for containerized backend environments (`Docker` stretch requirement).
- Define `.github/workflows/ci.yml` automating independent `tsc --noEmit` and `npm test` runs inside `frontend/` and `backend/` on every pull request.
- Establish the canonical `README.md` structure required for project evaluation checklists.

### Non-Goals

- Setting up managed relational database clusters (PostgreSQL) or AWS S3 bucket IAM policies (`Depends on SPEC-0009`).
- Implementing complex multi-region Kubernetes (`EKS`/`GKE`) or Terraform infrastructure.

---

## MVP Scope

- Vercel hosting configuration (`frontend/vercel.json`).
- Render hosting configuration (`backend/render.yaml`).
- Express CORS security middleware (`cors` package).
- Complete environment variable dictionary with `Zod` validation.
- GitHub Actions CI workflow (`.github/workflows/ci.yml`).
- Canonical `README.md` documentation template.

## Stretch Scope

- Multi-stage Docker container build (`Dockerfile.backend` and `docker-compose.yml`) enabling full stack execution via `docker compose up`.
- Automated Slack / Discord webhook alerts upon CI deployment failures.

---

## Technical Design

### Architecture

```mermaid
graph TD
    subgraph GitHub [Public GitHub Repository]
        Repo[ai-crm-lead-importer Repository]
        CI[GitHub Actions Workflow<br/>Type Check & Unit Tests]
    end

    subgraph Cloud Hosting Topology [Free-Tier Cloud Topology]
        subgraph Vercel Cloud [Vercel Global Edge Network]
            CDN[Next.js Static/Edge Assets]
            FE[Next.js Client Application<br/>https://groweasy-importer.vercel.app]
        end

        subgraph Render Cloud [Render / Railway Platform]
            BE[Express Node.js API Server<br/>https://groweasy-api.onrender.com]
            Health[GET /health check probe]
        end
    end

    subgraph External Services
        OpenAI[OpenAI API<br/>https://api.openai.com/v1]
    end

    Repo -->|Push / Merge| CI
    CI -->|Trigger Webhook| Vercel Cloud & Render Cloud
    FE ===|HTTPS REST POST /api/import<br/>CORS: Allow Origin| BE
    BE ===|HTTPS API Key Auth| OpenAI
    Health -.-> BE
```

### API Changes

#### `GET /health` (System Health & Readiness Probe)
To ensure Render/Railway zero-downtime rollouts, the backend exposes an unauthenticated health probe:
- **Response `200 OK`**:
  ```json
  {
    "status": "UP",
    "timestamp": "2026-07-10T14:30:00.000Z",
    "uptime_seconds": 3600
  }
  ```

### Database Changes

Not applicable.

### Infrastructure Changes

Creation of Vercel and Render application blueprints for both applications (`frontend/` and `backend/`).

### Error Handling

| Deployment / Runtime Fault | Symptom | Mitigation Strategy |
| :--- | :--- | :--- |
| **CORS Preflight Rejection** | Browser throws `CORS error` on `OPTIONS /api/import` | Express `cors()` middleware strictly validates `origin` header against `process.env.FRONTEND_URL`. |
| **OpenAI API Key Missing** | Backend crashes on startup with `ZodError` | `backend/src/config/env.ts` calls `Zod.parse(process.env)` at top-level; crashes with clear message before binding to `PORT`. |
| **Health Probe Timeout** | Render container restarts continuously | Ensure `GET /health` executes no database calls (`SPEC-0009`) or external API calls, returning `200 OK` directly from memory within $<10\text{ ms}$. |

---

## Implementation Details

### Folder Structure

```text
ai-crm-lead-importer/
├── .github/
│   └── workflows/
│       └── ci.yml                    # Automated PR type verification and test runner
├── frontend/
│   └── vercel.json                   # Vercel build and routing overrides
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts                # Zod runtime environment validator
│   │   └── middlewares/
│   │       └── cors.middleware.ts    # Strict CORS origin enforcement
│   ├── Dockerfile                    # Multi-stage production container build
│   └── render.yaml                   # Render infrastructure as code
├── docker-compose.yml                # Stretch local multi-container development environment
└── README.md                         # Project setup, evaluation instructions & deliverables
```

### Components & Infrastructure as Code

#### 1. CORS Middleware (`backend/src/middlewares/cors.middleware.ts`)

```typescript
import cors from 'cors';
import { createAppError } from '../utils/errors/create-app-error';

export function configureCors() {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
  ];

  return cors({
    origin: (origin, callback) => {
      # Allow requests with no origin (e.g. mobile apps, curl, Postman during testing)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(createAppError(`CORS policy rejection: Origin ${origin} not permitted.`, 'CORS_REJECTED', 403));
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-ID', 'Authorization'],
    credentials: true,
    maxAge: 86400, # Cache preflight OPTIONS response for 24 hours
  });
}
```

#### 2. Render Blueprint (`backend/render.yaml`)

```yaml
services:
  - type: web
    name: groweasy-importer-api
    env: node
    plan: free
    rootDir: .
    buildCommand: npm install && npm run build
    startCommand: node backend/dist/index.js
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3001
      - key: AI_BATCH_SIZE
        value: 50
      - key: MAX_BATCH_RETRIES
        value: 3
      - key: BATCH_CONCURRENCY_LIMIT
        value: 3
      - key: OPENAI_API_KEY
        sync: false # Must be entered securely via Render Dashboard
      - key: FRONTEND_URL
        value: https://groweasy-importer.vercel.app
```

#### 3. Multi-Stage Backend Dockerfile (`backend/Dockerfile`)
> Optional Stretch Feature: Enables enterprise container deployment via `docker build -t groweasy-api .`

```dockerfile
# Stage 1: Build & TypeScript Compilation
FROM node:20-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./backend/
RUN npm --prefix backend ci
COPY backend/ ./backend/
RUN npm --prefix backend run build

# Stage 2: Production Lightweight Runtime
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/backend/package*.json ./backend/
RUN npm --prefix backend ci --omit=dev && npm cache clean --force
COPY --from=builder /app/backend/dist ./backend/dist
EXPOSE 3001
CMD ["node", "backend/dist/index.js"]
```

#### 4. GitHub Actions CI Pipeline (`.github/workflows/ci.yml`)

```yaml
name: Applications CI Pipeline

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Frontend Dependencies
        run: npm --prefix frontend ci

      - name: Install Backend Dependencies
        run: npm --prefix backend ci

      - name: Type Check Frontend & Backend Applications
        run: |
          npm --prefix frontend run check-types
          npm --prefix backend run check-types

      - name: Execute Unit & Integration Tests
        run: npm --prefix backend test
        env:
          OPENAI_API_KEY: sk-mock-test-key-for-ci
          NODE_ENV: test
```

### Complete Environment Variable Dictionary

All environment variables across the two applications must be documented explicitly and validated at startup:

| Variable Name | Layer | Required? | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Both (`frontend` & `backend`) | No | `'development'` | Runtime environment string (`development` \| `production` \| `test`). |
| `PORT` | Backend | No | `3001` | Express HTTP server port (`SPEC-0001`). |
| `FRONTEND_URL` | Backend | Yes (Prod) | `'http://localhost:3000'` | Allowed CORS origin (`SPEC-0008`). |
| `NEXT_PUBLIC_API_URL` | Frontend | Yes | `'http://localhost:3001'` | Backend API endpoint base (`SPEC-0001`). |
| `OPENAI_API_KEY` | Backend | **Yes** | *None* | Secret key for `GPT-4.1 Mini` (`SPEC-0004`). |
| `OPENAI_MODEL` | Backend | No | `'gpt-4.1-mini'` | OpenAI target model ID (`SPEC-0004`). |
| `AI_BATCH_SIZE` | Backend | No | `50` | Rows per LLM batch prompt (`SPEC-0006`). |
| `MAX_BATCH_RETRIES`| Backend | No | `3` | Exponential backoff attempts (`SPEC-0006`). |
| `BATCH_CONCURRENCY_LIMIT`| Backend | No | `3` | Parallel active batch workers (`SPEC-0006`). |

---

## Security Considerations

- **Secure Secrets Injection**: `OPENAI_API_KEY` must never be hardcoded or committed to GitHub (`.gitignore` must explicitly ignore `.env`, `.env.local`, `.env.production`). In Render and Vercel dashboards, variables must be marked as encrypted environment variables.
- **Header Obfuscation**: Express must disable the default `X-Powered-By: Express` header (`app.disable('x-powered-by')`) using `helmet` or manual middleware to prevent automated server profiling.

---

## Testing Strategy

- **Health Probe Verification**: Automated CI ping asserting `GET /health` returns `status: "UP"` and HTTP status code `200` without requiring external OpenAI credentials.
- **CORS Contract Assertions**: `Supertest` tests firing `OPTIONS /api/import` with `Origin: https://evil-site.com`. Assert HTTP `403 Forbidden` and `CORS_REJECTED` error code. Repeat with `Origin: https://groweasy-importer.vercel.app`; assert `200 OK` and presence of `Access-Control-Allow-Origin` header.

---

## Observability

- **Startup Diagnostics Banner**: Upon successful port binding in `backend/src/index.ts`, the application emits an initialization audit log summarizing active resilience parameters:
  ```json
  {
    "event": "service_initialized",
    "port": 3001,
    "node_env": "production",
    "cors_allowed_origin": "https://groweasy-importer.vercel.app",
    "ai_model": "gpt-4.1-mini",
    "batch_size": 50,
    "max_retries": 3,
    "concurrency_limit": 3
  }
  ```

---

## Rollout & Final Deliverables Checklist (`README.md` Structure)

To fulfill project documentation and evaluation requirements, the root `README.md` must strictly contain these exact sections:

```markdown
# AI-Powered CRM CSV Importer v2.0

## 🚀 Public Live Demo URLs
- **Frontend Application (Vercel)**: https://groweasy-importer.vercel.app
- **Backend API Server (Render)**: https://groweasy-api.onrender.com/health
- **Public GitHub Repository**: https://github.com/groweasy-org/ai-crm-lead-importer

## 📦 Local Setup Instructions
1. Clone the repository: `git clone https://github.com/groweasy-org/ai-crm-lead-importer.git`
2. Install dependencies: `npm install`
3. Configure environment:
   - Copy `backend/.env.example` to `backend/.env` and insert your `OPENAI_API_KEY`.
   - Copy `frontend/.env.example` to `frontend/.env.local`.
4. Run locally: `npm run dev` (Starts Next.js on :3000 and Express on :3001).

## 🏆 Architectural Features & SPECs
- **Stateless Zero-Latency Upload**: PapaParse browser-side preview (`SPEC-0002`).
- **Resilient AI Extraction**: GPT-4.1 Mini mapping (`SPEC-0004`) + Exponential Backoff Engine (`SPEC-0006`).
- **Strict Business Validation**: Skip-record rules (`!email && !mobile`) & normalization (`SPEC-0005`).
- **RFC 4180 CSV Exporter**: One-click download of processed and skipped leads without row corruption (`SPEC-0007`).
```

---

## Alternatives Considered

### 1. AWS ECS Fargate / EKS vs. Render + Vercel
- **Justification for Rejection**: AWS Fargate/EKS requires provisioning VPCs, ALBs, NAT Gateways ($>\$35/\text{month}$ fixed cost), and complex IAM policies. The project architectural guidelines explicitly state that auxiliary infrastructure should not compromise shipping the core AI workflow on time (per project architectural goals). Vercel + Render provides single-command Git-backed zero-downtime deployment on free tiers with zero operational maintenance.

### 2. Monolithic Next.js API Routes (`app/api/import/route.ts`) vs. Separate Express Backend
- **Justification for Rejection**: While combining Express into Next.js API routes simplifies hosting (`Vercel Only`), Next.js Serverless Functions enforce a strict $10\text{-second}$ timeout on Vercel Hobby tier ($60\text{ s}$ on Pro). Processing a 2,000-row CSV across 40 AI batches ($40 \times 2.5\text{ s} = 100\text{ s}$) would consistently trigger serverless execution timeouts (`504 Gateway Timeout`). Hosting a persistent long-lived Express server on Render guarantees reliable long-running batch processing (`SPEC-0006`).

---

## Questions and Concerns

- **Question**: How does the frontend handle Render's free-tier cold-boot sleep delays ($~50\text{ seconds}$ after inactivity)?
- **Decision**: The `<CsvDropzone />` component (`SPEC-0002`) sends a lightweight background ping (`fetch(NEXT_PUBLIC_API_URL + '/health')`) when the user selects a file. By the time the user reviews the preview table and clicks "Confirm Import", the Render backend instance has fully woken up.

---

## References

- [Render Express Deployment Guide](https://render.com/docs/deploy-node-express-app)
- [Vercel Next.js Deployment Best Practices](https://vercel.com/docs/frameworks/nextjs)
- [CORS Middleware Official Documentation](https://expressjs.com/en/resources/middleware/cors.html)
- `Depends on all MVP SPECs (SPEC-0001 through SPEC-0007)`
