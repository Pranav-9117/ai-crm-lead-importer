# Database SPEC-0009: Optional Persistence & Archival Storage

## Metadata

| Field | Value |
| :--- | :--- |
| **SPEC ID** | `SPEC-0009` |
| **Title** | Optional Stateful Persistence Layer (PostgreSQL, AWS S3 Archival & Import Auditing) |
| **Layer** | Database / Storage / Stretch Feature |
| **Status** | Implementation-Ready (Stretch Only) |
| **Authors** | Principal Software Architect |
| **Reviewers** | Senior Data & Backend Engineering Teams |
| **Dependencies** | Extends `SPEC-0003`, `SPEC-0005`, and `SPEC-0007` |

---

## Summary

> **CRITICAL ARCHITECTURAL NOTICE: THIS SPECIFICATION IS EXPLICITLY NOT REQUIRED FOR THE MVP.**
> As documented in project architectural guidelines (*"OPTIONAL — in-memory/stateless by default; Postgres only if time permits... assignment explicitly allows stateless... Cutting these is not a quality compromise; it's the correct prioritization for the time available"*), the core application (`SPEC-0001` through `SPEC-0008`) is designed to operate 100% statelessly and in-memory. 

`SPEC-0009` defines the **Stretch Scope** stateful extension layer. When enterprise compliance mandates persistent audit trails, historical import dashboards (`Import History`), raw file archival (`AWS S3`), real-time Server-Sent Events (`SSE`) progress streaming, and background job reprocessing, this specification extends the stateless boundaries of `SPEC-0003` (`Import API`), `SPEC-0005` (`Validation`), and `SPEC-0007` (`Results UI`) without breaking existing DTO contracts.

---

## Motivation

In a stateless architecture, if a user closes their browser tab after an import job completes (`SPEC-0007`), the extracted CRM leads and skip logs are lost from server and browser memory. For large enterprise sales operations, retaining relational import histories, tracking AI token cost analytics over time, archiving the original raw `.csv` upload to durable object storage (`AWS S3`), and enabling partial job reprocessing from disk (`Reprocessing`) are high-value stretch capabilities.

### Goals

- Define a relational database schema (`PostgreSQL` via `Prisma` or `pg` migrations) modeling four core entities: `ImportJob`, `Lead`, `SkippedRecord`, and `ImportBatch` (per project optional persistence entity rules).
- Implement an AWS S3 object storage service (`S3ArchivalService`) to stream and persist the raw uploaded CSV file under a unique `s3_key` prior to batch splitting.
- Extend `POST /api/import` (`Extends SPEC-0003`) to create an `ImportJob` record (`status: 'PROCESSING'`) and persist worker outputs asynchronously.
- Expose stateful REST endpoints for historical auditing: `GET /api/jobs` (pagination/filtering) and `GET /api/jobs/:id` (full details with leads and skipped items).
- Implement Server-Sent Events (`GET /api/import/progress/:jobId`) allowing the frontend (`Extends SPEC-0007`) to render a real-time progress bar ($0\% \rightarrow 100\%$) across large batches.
- Expose `POST /api/jobs/:id/reprocess` allowing administrators to re-run AI extraction exclusively on `SkippedRecord` entries.

### Non-Goals

- Blocking or delaying the core stateless MVP workflow if database connection strings (`DATABASE_URL`) or AWS S3 credentials (`AWS_ACCESS_KEY_ID`) are absent.
- Implementing multi-tenant row-level security (RLS) or complex user authentication (`Depends on future Auth SPEC`).

---

## MVP Scope

- **EXPLICITLY NONE.** All functionality defined within `SPEC-0009` belongs strictly to **Stretch Scope**.

## Stretch Scope

- Relational PostgreSQL database schema (`schema.prisma`) and migration scripts.
- AWS S3 / Cloudflare R2 object storage integration (`@aws-sdk/client-s3`).
- Repository layer (`JobRepository`, `LeadRepository`).
- SSE Progress Streamer (`ServerSentEventsService`).
- Historical Analytics Dashboard API (`GET /api/analytics/summary`).
- Background worker reprocessing service.

---

## Technical Design

### Architecture

```mermaid
graph TD
    subgraph Client & UI Layer
        Results[ImportResultsDashboard - Extends SPEC-0007]
        History[Import History & Analytics Page - Stretch UI]
    end

    subgraph API Layer - Extends SPEC-0003
        ImportCtrl[ImportController POST /api/import]
        JobCtrl[JobController GET /api/jobs & /api/jobs/:id]
        SSECtrl[SSEProgressController GET /api/import/progress/:jobId]
        ReprocCtrl[ReprocessController POST /api/jobs/:id/reprocess]
    end

    subgraph Storage & Persistence Services - SPEC-0009
        S3[AWS S3 Archival Service<br/>Upload original raw CSV to s3_key]
        Repo[PostgreSQL Repository Layer<br/>Prisma ORM / pg]
        SSEPub[SSE Event Broker<br/>Publishes batch completion ticks]
    end

    subgraph Database Engines
        Postgres[(PostgreSQL Relational DB<br/>ImportJob, Lead, SkippedRecord, ImportBatch)]
        S3Bucket[(AWS S3 / R2 Bucket<br/>s3://groweasy-raw-csvs/)]
    end

    Results <==>|SSE Streaming Progress| SSECtrl
    History ==>|GET /api/jobs & /api/analytics| JobCtrl
    ImportCtrl -->|1. Archive Raw File| S3
    S3 -->|Save s3_key| S3Bucket
    ImportCtrl -->|2. Create Job Record| Repo
    Repo <==> Postgres
    
    JobCtrl --> Repo
    ReprocCtrl -->|Fetch Skipped & Re-invoke Batch Framework SPEC-0006| Repo
```

### Database Schema (`prisma/schema.prisma`)
> Assumption: Entity definitions match the exact key fields specified in project optional persistence entity rules.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum JobStatus {
  PENDING
  PROCESSING
  COMPLETED
  PARTIALLY_COMPLETED
  FAILED
}

model ImportJob {
  id               String          @id @default(uuid())
  filename         String
  s3_key           String?         // Optional if AWS S3 is disabled
  status           JobStatus       @default(PENDING)
  total_rows       Int             @default(0)
  processed_rows   Int             @default(0)
  imported_rows    Int             @default(0)
  skipped_rows     Int             @default(0)
  total_tokens     Int             @default(0)
  estimated_cost   Float           @default(0.0)
  created_at       DateTime        @default(now())
  updated_at       DateTime        @updatedAt

  leads            Lead[]
  skipped_records  SkippedRecord[]
  batches          ImportBatch[]

  @@map("import_jobs")
}

model Lead {
  id                          String     @id @default(uuid())
  import_job_id               String
  name                        String?
  email                       String?
  country_code                String?
  mobile_without_country_code String?
  company                     String?
  city                        String?
  state                       String?
  country                     String?
  lead_owner                  String?
  crm_status                  String?    // Stored as validated enum string
  crm_note                    String     @db.Text
  data_source                 String?    // Stored as validated enum string
  possession_time             String?
  description                 String?    @db.Text
  created_at                  DateTime

  import_job                  ImportJob  @relation(fields: [import_job_id], references: [id], onDelete: Cascade)

  @@index([import_job_id])
  @@index([email])
  @@index([mobile_without_country_code])
  @@map("leads")
}

model SkippedRecord {
  id             String    @id @default(uuid())
  import_job_id  String
  row_number     Int
  reason         String    @db.Text
  raw_row        Json      // Stored as PostgreSQL JSONB column
  created_at     DateTime  @default(now())

  import_job     ImportJob @relation(fields: [import_job_id], references: [id], onDelete: Cascade)

  @@index([import_job_id])
  @@map("skipped_records")
}

model ImportBatch {
  id              String    @id @default(uuid())
  import_job_id   String
  batch_number    Int
  rows_processed  Int       @default(0)
  tokens          Int       @default(0)
  estimated_cost  Float     @default(0.0)
  status          String    // 'SUCCESS' | 'FAILED'

  import_job      ImportJob @relation(fields: [import_job_id], references: [id], onDelete: Cascade)

  @@index([import_job_id])
  @@map("import_batches")
}
```

### API Extensions

#### 1. `GET /api/jobs` (Paginated Import History)
- **Query Parameters**: `page=1&limit=20&status=COMPLETED`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "jobs": [
        {
          "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
          "filename": "q3_meridian_leads.csv",
          "status": "COMPLETED",
          "total_rows": 500,
          "imported_rows": 480,
          "skipped_rows": 20,
          "total_tokens": 12400,
          "estimated_cost": 0.0062,
          "created_at": "2026-07-10T14:00:00.000Z"
        }
      ],
      "pagination": { "page": 1, "limit": 20, "total_records": 1, "total_pages": 1 }
    }
  }
  ```

#### 2. `GET /api/import/progress/:jobId` (Server-Sent Events Stream)
- **Protocol**: `text/event-stream`
- **Stream Events Emitted**:
  ```text
  event: progress
  data: {"jobId":"f47...","processedRows":150,"totalRows":500,"percentage":30,"status":"PROCESSING"}

  event: complete
  data: {"jobId":"f47...","processedRows":500,"totalRows":500,"percentage":100,"status":"COMPLETED"}
  ```

#### 3. `POST /api/jobs/:id/reprocess` (Reprocess Skipped Records)
Extracts all `SkippedRecord` items for the target `id`, extracts their `raw_row` JSON, and feeds them back through `BatchProcessingFramework.processAllBatches()` (`SPEC-0006`). Successfully mapped leads are inserted into `Lead` and deleted from `SkippedRecord`.

---

## Implementation Details

### Folder Structure

```text
backend/src/
├── controllers/
│   ├── jobs.controller.ts             # Route handlers for GET /api/jobs & /api/jobs/:id
│   ├── sse.controller.ts              # Route handler for SSE streaming
│   └── reprocess.controller.ts        # Route handler for POST /api/jobs/:id/reprocess
├── services/
│   ├── persistence/
│   │   ├── prisma.client.ts           # Lazy-initialized Prisma database wrapper
│   │   ├── jobRepository.service.ts   # CRUD operations for ImportJob, Lead, SkippedRecord
│   │   └── s3Archival.service.ts      # AWS S3 upload and download service
│   └── sseBroker.service.ts           # In-memory EventEmitter pub/sub for SSE connections
└── prisma/
    └── schema.prisma                  # Canonical PostgreSQL schema
```

### Components & TypeScript Interfaces

#### 1. Lazy Persistence Check & Repository (`backend/src/services/persistence/jobRepository.service.ts`)
To ensure `SPEC-0009` remains strictly non-blocking for stateless MVP deployments, the repository checks for `process.env.DATABASE_URL` before executing:

```typescript
import { PrismaClient } from '@prisma/client';
import { LeadDTO, SkippedRecordDTO } from '../../types/lead';

export class JobRepositoryService {
  private prisma: PrismaClient | null = null;
  private isEnabled = false;

  constructor() {
    if (process.env.DATABASE_URL) {
      this.prisma = new PrismaClient();
      this.isEnabled = true;
    }
  }

  public async createJob(jobId: string, filename: string, totalRows: number, s3Key?: string): Promise<void> {
    if (!this.isEnabled || !this.prisma) return; # No-op if persistence disabled
    await this.prisma.importJob.create({
      data: { id: jobId, filename, total_rows: totalRows, status: 'PROCESSING', s3_key: s3Key },
    });
  }

  public async saveBatchResults(
    jobId: string,
    batchNumber: number,
    imported: LeadDTO[],
    skipped: SkippedRecordDTO[],
    tokens: number,
    cost: number
  ): Promise<void> {
    if (!this.isEnabled || !this.prisma) return;

    await this.prisma.$transaction([
      # Insert batch audit row
      this.prisma.importBatch.create({
        data: {
          import_job_id: jobId,
          batch_number: batchNumber,
          rows_processed: imported.length + skipped.length,
          tokens,
          estimated_cost: cost,
          status: 'SUCCESS',
        },
      }),
      # Bulk insert imported leads
      this.prisma.lead.createMany({
        data: imported.map((lead) => ({
          id: lead.id,
          import_job_id: jobId,
          name: lead.name,
          email: lead.email,
          country_code: lead.country_code,
          mobile_without_country_code: lead.mobile_without_country_code,
          company: lead.company,
          city: lead.city,
          state: lead.state,
          country: lead.country,
          lead_owner: lead.lead_owner,
          crm_status: lead.crm_status,
          crm_note: lead.crm_note,
          data_source: lead.data_source,
          possession_time: lead.possession_time,
          description: lead.description,
          created_at: new Date(lead.created_at),
        })),
      }),
      # Bulk insert skipped records
      this.prisma.skippedRecord.createMany({
        data: skipped.map((skip) => ({
          import_job_id: jobId,
          row_number: skip.row_number,
          reason: skip.reason,
          raw_row: skip.raw_row as any,
        })),
      }),
      # Increment job totals
      this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          processed_rows: { increment: imported.length + skipped.length },
          imported_rows: { increment: imported.length },
          skipped_rows: { increment: skipped.length },
          total_tokens: { increment: tokens },
          estimated_cost: { increment: cost },
        },
      }),
    ]);
  }
}
```

#### 2. AWS S3 Archival Service (`backend/src/services/persistence/s3Archival.service.ts`)

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { CSVRow } from '../../types/csv';

export class S3ArchivalService {
  private s3: S3Client | null = null;
  private bucket: string | null = null;

  constructor() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_S3_BUCKET_NAME) {
      this.s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
      this.bucket = process.env.AWS_S3_BUCKET_NAME;
    }
  }

  /**
   * Uploads raw CSV rows as a reconstructed file to S3. Returns the s3_key or null if S3 is disabled.
   */
  public async archiveRawCsv(jobId: string, filename: string, rows: CSVRow[]): Promise<string | null> {
    if (!this.s3 || !this.bucket || rows.length === 0) return null;

    const s3Key = `raw-imports/${new Date().toISOString().split('T')[0]}/${jobId}_${filename}`;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: Buffer.from(csvContent, 'utf-8'),
        ContentType: 'text/csv',
      })
    );

    return s3Key;
  }
}
```

### Dependencies

- `@prisma/client` (^5.11.0) & `prisma` (^5.11.0) — Relational ORM and migration tool.
- `@aws-sdk/client-s3` (^3.530.0) — Official AWS S3 SDK for archival storage.

### Configuration & Environment Variables

| Variable Name | Layer | Required? | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Database (Stretch) | No | *None* | PostgreSQL connection string e.g. `postgresql://user:pass@localhost:5432/groweasy`. |
| `AWS_ACCESS_KEY_ID` | Storage (Stretch) | No | *None* | AWS IAM credentials for S3 bucket upload. |
| `AWS_SECRET_ACCESS_KEY`| Storage (Stretch) | No | *None* | AWS secret access key. |
| `AWS_S3_BUCKET_NAME` | Storage (Stretch) | No | *None* | Target S3 bucket name (e.g. `groweasy-raw-csvs`). |
| `AWS_REGION` | Storage (Stretch) | No | `'us-east-1'` | Target S3 bucket AWS region. |

### Performance Considerations

- **Prisma Batch Transactions**: Executing 50 individual `prisma.lead.create()` inserts per batch causes roundtrip database latency ($~150\text{ ms}$). `JobRepositoryService` uses `prisma.lead.createMany()` wrapped inside `prisma.$transaction()`, committing all 50 records plus audit counters in a single atomic SQL transaction ($<15\text{ ms}$).

### Scalability

When persistence (`SPEC-0009`) is enabled alongside SSE streaming (`GET /api/import/progress/:jobId`), the Express server can support $10,000+$ row imports by returning a `202 Accepted` response immediately with `job_id`. Background workers (`BatchProcessingFramework`) execute batch transactions against PostgreSQL, and the frontend `<ImportResultsDashboard />` (`SPEC-0007`) updates its progress bar via SSE ticks until receiving `status: 'COMPLETED'`, at which point it queries `GET /api/jobs/:id` for the final data tables.

---

## Security Considerations

- **SQL Injection Prevention**: Using `Prisma ORM` guarantees parameter binding for all string fields (`name`, `company`, `crm_note`), eliminating SQL injection risks even when ingesting messy, untrusted CSV cells.
- **S3 Bucket Private ACLs**: Uploaded objects (`s3_key`) must be written with `ACL: 'private'`. Download requests must be mediated by pre-signed URLs generated server-side with a maximum TTL of $15\text{ minutes}$.

---

## Testing Strategy

- **Graceful Stateless Fallback**: Run backend unit tests with `DATABASE_URL` and `AWS_ACCESS_KEY_ID` deleted from environment. Assert that `JobRepositoryService.createJob()` and `S3ArchivalService.archiveRawCsv()` execute as safe no-ops (`return null/void`) without throwing errors, ensuring the core stateless MVP (`SPEC-0003`) remains 100% functional.
- **Transactional Atomicity**: Use `Testcontainers` (PostgreSQL container). Mock a batch validation return where `createMany` for `skippedRecord` throws a database constraint violation. Assert that `prisma.$transaction` rolls back the `lead.createMany` and `importJob.update` counters completely, preventing dirty partial database reads.

---

## Observability

- **Database Pool Telemetry**: When `DATABASE_URL` is active, the backend emits structured connection pool metrics every 60 seconds:
  ```json
  {
    "event": "pg_pool_metrics",
    "active_connections": 4,
    "idle_connections": 6,
    "waiting_requests": 0
  }
  ```

---

## Rollout Plan (Stretch Scope)

1. Initialize `npx prisma init` in `backend/` and write `prisma/schema.prisma`.
2. Run `npx prisma migrate dev --name init_import_tables` against a local/hosted PostgreSQL database.
3. Implement `JobRepositoryService` and `S3ArchivalService` with strict conditional enabled/disabled checks (`if (!this.isEnabled) return`).
4. Inject `JobRepositoryService.saveBatchResults()` into the completion callback of `BatchProcessingFramework.processAllBatches()` (`SPEC-0006`).

---

## Alternatives Considered

### 1. MongoDB / NoSQL Document Store vs. PostgreSQL
- **Justification for Rejection**: While MongoDB natively stores dynamic JSON structures (`raw_row`), project guidelines specify **PostgreSQL** as the target database engine (PostgreSQL optional target; Database Schema: `ImportJob`, `Lead`, `SkippedRecord`, `ImportBatch`). Furthermore, relational foreign keys (`import_job_id`) and SQL aggregations (`SUM(total_tokens)`) make PostgreSQL superior for structured audit reporting and analytics.

### 2. Mandatory Database Requirement for MVP vs. Optional Stretch
- **Justification for Rejection**: As exhaustively detailed in project recommendations, requiring a live PostgreSQL instance and AWS S3 bucket to evaluate a 2-day take-home submission creates unnecessary setup friction and deployment failure points for evaluators. Keeping `SPEC-0009` as an optional, modular extension guarantees that the core AI extraction engine works instantly in any stateless environment while showcasing enterprise architecture readiness.

---

## Questions and Concerns

- **Question**: Can an `ImportJob` be resumed if the Node.js server crashes halfway through batch processing when persistence (`SPEC-0009`) is enabled?
- **Decision**: Yes. Because `BatchProcessingFramework` commits each batch inside a `prisma.$transaction`, if the server restarts, a recovery worker can query `ImportBatch` records where `import_job_id = X`, identify which batch numbers are missing (`status != SUCCESS`), and resume processing strictly from the first uncompleted batch index.

---

## References

- [Prisma ORM PostgreSQL Transactions Guide](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [AWS SDK for JavaScript v3 S3 Documentation](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
- `Extends SPEC-0003` (`ImportController` persistent extension)
- `Extends SPEC-0005` (`AIValidationService` database saving)
- `Extends SPEC-0007` (`Results UI` historical history loading and SSE streaming)
