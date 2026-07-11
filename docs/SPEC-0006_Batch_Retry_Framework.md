# Infrastructure SPEC-0006: Batch Processing & Retry Framework

## Metadata

| Field | Value |
| :--- | :--- |
| **SPEC ID** | `SPEC-0006` |
| **Title** | Batch Processing, Concurrency Control & Exponential Backoff Retry Framework |
| **Layer** | Backend Infrastructure / Resilience |
| **Status** | Implementation-Ready |
| **Authors** | Principal Software Architect |
| **Reviewers** | Senior Backend Infrastructure & Platform Teams |
| **Dependencies** | Depends on `SPEC-0003` (and `SPEC-0001`) |

---

## Summary

This specification defines the high-performance batching and resilience engine (`BatchProcessor`) embedded within the backend application. When `POST /api/import` (`SPEC-0003`) receives up to 5,000 unmapped CSV rows, sending them across a single LLM API prompt would exceed model context windows, trigger HTTP 413/429 limits, and cause catastrophic single-point failures. `SPEC-0006` splits large row arrays into discrete chunks configured by `AI_BATCH_SIZE` (default: 50), executes workers with strict concurrency bounding, and wraps external LLM calls (`Depends on SPEC-0004`) in an exponential backoff retry loop (`2s, 4s, 8s` up to `MAX_BATCH_RETRIES`) tailored specifically for transient network drops, OpenAI `429 Rate Limit` errors, and `5xx` server faults. Retries are strictly isolated to the failed batch.

---

## Motivation

External LLM APIs (`GPT-4.1 Mini`) exhibit variable latency, strict token rate limits ($TDM$ / $RPM$), and intermittent `HTTP 502/503/504` service degradation. A production-grade CRM importer must never abort a 4,000-row import job simply because batch \#42 encountered a transient OpenAI timeout or rate limit.

### Goals

- Implement deterministic array chunking (`splitIntoBatches`) dividing input `CSVRow[]` into slices of `AI_BATCH_SIZE` (default: 50 rows per batch).
- Implement bounded worker concurrency using a semaphore/pool pattern (e.g. `p-limit` or native async pool of maximum 3 concurrent workers) to prevent flooding the OpenAI API while maintaining high throughput.
- Enforce transient error classification: retry strictly when catching HTTP `429 (Too Many Requests)`, `500/502/503/504`, or socket connection resets (`ECONNRESET`, `ETIMEDOUT`).
- Enforce exponential backoff with jitter: $2\text{ s} \rightarrow 4\text{ s} \rightarrow 8\text{ s}$ up to `MAX_BATCH_RETRIES` (default: 3 retries per batch).
- Isolate failures: if a single batch fails all retries, mark its rows as skipped with explicit error reasons (`API_EXHAUSTED_RETRIES`) without discarding successfully processed batches.

### Non-Goals

- Constructing the GPT-4.1 Mini prompt template or managing token encoding (`Depends on SPEC-0004`).
- Validating the JSON output against the `LeadDTO` schema or enforcing skip-record rules (`Depends on SPEC-0005`).
- Persisting batch execution states or worker logs to PostgreSQL (`Depends on SPEC-0009`).

---

## MVP Scope

- `BatchProcessor` service class implementation.
- Array chunking engine (`AI_BATCH_SIZE` environment variable driven).
- Worker execution pool with max 3 concurrent tasks.
- Exponential backoff retry decorator (`retryWithBackoff`) with transient error discrimination (`MAX_BATCH_RETRIES` driven).
- Aggregation of intermediate batch outputs (`LeadDTO[]`, `SkippedRecordDTO[]`, token consumption metrics) back to the calling controller (`SPEC-0003`).

## Stretch Scope

- Dead-Letter Queue (DLQ) dumping permanently failed batches to local scratch JSON files or S3 buckets (`Depends on SPEC-0009`) for manual replay.
- Dynamic rate-limit self-throttling: automatically reducing `concurrency` from 3 to 1 upon detecting sustained `429` responses (`Token Bucket` adaptive throttling).

---

## Technical Design

### Architecture

The framework operates as a middleware processing layer between `ImportOrchestrationService` (`SPEC-0003`) and the AI client (`SPEC-0004`).

```mermaid
graph TD
    subgraph Controller Layer
        Orch[ImportOrchestrationService - SPEC-0003]
    end

    subgraph Batch Processing Framework - SPEC-0006
        Splitter[Batch Chunking Engine<br/>chunk by AI_BATCH_SIZE=50]
        Pool[Worker Concurrency Pool<br/>Limit = 3 Active Workers]
        
        subgraph Worker Execution Unit
            RetryLoop[Exponential Backoff Loop<br/>2s -> 4s -> 8s + Jitter]
            AIClient[AI Extraction Engine<br/>Depends on SPEC-0004]
            Validator[AI Response Validator<br/>Depends on SPEC-0005]
        end
        
        Aggregator[Batch Result Aggregator]
    end

    Orch -->|CSVRow[]| Splitter
    Splitter -->|Batches 1..N| Pool
    Pool -->|Batch K| RetryLoop
    RetryLoop -->|Attempt M| AIClient
    AIClient -->|Raw AI JSON| Validator
    Validator -->|BatchResultDTO| Aggregator
    
    RetryLoop -.->|HTTP 429/5xx (Retry up to MAX_BATCH_RETRIES)| RetryLoop
    RetryLoop -.->|Permanent Error or Exhausted| Aggregator
    Aggregator -->|Unified Job Summary| Orch
```

### Worker Lifecycle Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Pool as Concurrency Pool
    participant Worker as Worker Task (Batch K)
    participant Retry as Retry Engine
    participant AI as AI Extraction Engine (SPEC-0004)
    participant Val as AI Validator (SPEC-0005)

    Pool->>Worker: executeBatch(batchNumber, rows[150..199])
    Worker->>Retry: executeWithRetry(() => AI.extractAndMap(rows))
    
    rect rgb(40, 20, 20)
        Note over Retry,AI: Attempt 1 — Encounter Transient Rate Limit
        Retry->>AI: POST https://api.openai.com/v1/chat/completions
        AI-->>Retry: HTTP 429 Too Many Requests (Retry-After: 2)
        Retry->>Retry: Classify as Transient; sleep(2000ms + Jitter)
    end

    rect rgb(20, 40, 20)
        Note over Retry,AI: Attempt 2 — Success
        Retry->>AI: POST https://api.openai.com/v1/chat/completions
        AI-->>Retry: HTTP 200 OK (JSON Payload + Usage Tokens)
    end

    Retry-->>Worker: Raw Extracted JSON
    Worker->>Val: validateAndNormalize(rawJson, originalRows)
    Val-->>Worker: { imported: LeadDTO[], skipped: SkippedRecordDTO[] }
    Worker-->>Pool: Return BatchExecutionResultDTO
```

### API Changes

Not applicable (`SPEC-0006` exposes internal TypeScript service APIs to `SPEC-0003`).

### Database Changes

Not applicable (`SPEC-0006` operates statelessly in-memory for MVP).

### Infrastructure Changes

Not applicable (`SPEC-0008` manages hosting).

### Error Handling & Classification

| Error Type | Status Codes / Errors | Classification | Action |
| :--- | :--- | :--- | :--- |
| **OpenAI Rate Limit** | HTTP `429` | `TRANSIENT` | Extract `Retry-After` header if present; otherwise apply `2s * 2^attempt + jitter`. Retry up to `MAX_BATCH_RETRIES`. |
| **OpenAI Server Error** | HTTP `500, 502, 503, 504` | `TRANSIENT` | Apply exponential backoff (`2s, 4s, 8s`). Retry up to `MAX_BATCH_RETRIES`. |
| **Network Socket Drop** | `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND` | `TRANSIENT` | Apply exponential backoff (`2s, 4s, 8s`). Retry up to `MAX_BATCH_RETRIES`. |
| **Authentication Failure**| HTTP `401 Unauthorized`, `403 Forbidden` | `PERMANENT` | Abort batch immediately. Throw `createAppError('OPENAI_AUTH_FAILED')` to halt entire job. |
| **Invalid Prompt / Context**| HTTP `400 Bad Request`, `413 Payload Too Large`| `PERMANENT` | Do not retry. Mark all rows in this batch as skipped (`SkippedRecordDTO`) with `reason: 'BATCH_API_PAYLOAD_REJECTED'`. |
| **Retries Exhausted** | Attempt count $> \text{MAX\_BATCH\_RETRIES}$ | `EXHAUSTED` | Mark all rows in batch as `SkippedRecordDTO` with `reason: 'OPENAI_SERVICE_UNAVAILABLE_AFTER_RETRIES'`. |

---

## Implementation Details

### Folder Structure

```text
backend/src/services/
├── batchProcessingFramework.service.ts # Core batch chunking and pool orchestrator
└── utils/
    ├── retryEngine.ts                  # Exponential backoff decorator with jitter
    └── concurrencyPool.ts              # Lightweight async semaphore pool wrapper
```

### Components & TypeScript Interfaces

#### 1. Internal DTOs (`backend/src/services/batchProcessingFramework.service.ts`)

```typescript
import { LeadDTO, SkippedRecordDTO } from '../types/lead';
import { CSVRow } from '../types/csv';

export interface BatchExecutionResultDTO {
  batchNumber: number;
  rowsProcessed: number;
  imported: LeadDTO[];
  skipped: SkippedRecordDTO[];
  metrics: {
    tokensUsed: number;
    estimatedCostUsd: number;
    attempts: number;
    executionDurationMs: number;
  };
}

export interface AggregatedImportResultDTO {
  imported: LeadDTO[];
  skipped: SkippedRecordDTO[];
  totalTokensUsed: number;
  estimatedCostUsd: number;
  batchesCompleted: number;
  batchesFailed: number;
}
```

#### 2. Exponential Backoff Engine (`backend/src/services/utils/retryEngine.ts`)

```typescript
import { AppError } from '../../utils/errors/app-error';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Executes a target async operation with exponential backoff and jitter.
 */
export async function executeWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      attempt++;

      # Determine if error is transient
      const isTransient =
        error.status === 429 ||
        (error.status >= 500 && error.status <= 504) ||
        ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code);

      if (!isTransient || attempt > options.maxRetries) {
        throw error;
      }

      # Calculate exponential delay: baseDelay * 2^(attempt - 1) + jitter (0-500ms)
      let delayMs = options.baseDelayMs * Math.pow(2, attempt - 1);
      
      # Honor Retry-After header if HTTP 429 explicitly provides it
      if (error.status === 429 && error.headers && error.headers['retry-after']) {
        const retryAfterSeconds = parseInt(error.headers['retry-after'], 10);
        if (!isNaN(retryAfterSeconds)) {
          delayMs = retryAfterSeconds * 1000;
        }
      }

      # Add jitter and cap at maxDelayMs
      const jitter = Math.floor(Math.random() * 500);
      delayMs = Math.min(delayMs + jitter, options.maxDelayMs);

      if (onRetry) {
        onRetry(attempt, error, delayMs);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
```

#### 3. Core Batch Processing Framework (`batchProcessingFramework.service.ts`)

```typescript
import pLimit from 'p-limit';
import { LeadDTO, SkippedRecordDTO } from '../types/lead';
import { CSVRow } from '../types/csv';
import { createAppError } from '../utils/errors/create-app-error';
import { BatchExecutionResultDTO, AggregatedImportResultDTO } from './batchProcessingFramework.service';
import { executeWithBackoff } from './utils/retryEngine';
# Depends on SPEC-0004 & SPEC-0005
import { AIClient } from './aiExtraction.service';
import { ResponseValidator } from './aiValidation.service';

export class BatchProcessor {
  private aiEngine: AIClient;
  private validator: ResponseValidator;
  private batchSize: number;
  private maxRetries: number;
  private concurrencyLimit: number;

  constructor(
    aiEngine = new AIClient(),
    validator = new ResponseValidator()
  ) {
    this.aiEngine = aiEngine;
    this.validator = validator;
    this.batchSize = parseInt(process.env.AI_BATCH_SIZE || '50', 10);
    this.maxRetries = parseInt(process.env.MAX_BATCH_RETRIES || '3', 10);
    this.concurrencyLimit = parseInt(process.env.BATCH_CONCURRENCY_LIMIT || '3', 10);
  }

  public async processAllBatches(jobId: string, rows: CSVRow[]): Promise<AggregatedImportResultDTO> {
    const batches: { batchNumber: number; rows: CSVRow[]; startIndex: number }[] = [];
    
    # 1. Chunk array deterministically
    for (let i = 0; i < rows.length; i += this.batchSize) {
      batches.push({
        batchNumber: Math.floor(i / this.batchSize) + 1,
        rows: rows.slice(i, i + this.batchSize),
        startIndex: i,
      });
    }

    # 2. Initialize concurrency limiter (p-limit)
    const limit = pLimit(this.concurrencyLimit);

    # 3. Schedule all workers
    const batchPromises = batches.map((batch) =>
      limit(() => this.executeSingleBatchWorker(jobId, batch.batchNumber, batch.rows, batch.startIndex))
    );

    const results = await Promise.all(batchPromises);

    # 4. Aggregate results across all batches
    const aggregated: AggregatedImportResultDTO = {
      imported: [],
      skipped: [],
      totalTokensUsed: 0,
      estimatedCostUsd: 0,
      batchesCompleted: 0,
      batchesFailed: 0,
    };

    for (const res of results) {
      aggregated.imported.push(...res.imported);
      aggregated.skipped.push(...res.skipped);
      aggregated.totalTokensUsed += res.metrics.tokensUsed;
      aggregated.estimatedCostUsd += res.metrics.estimatedCostUsd;
      
      if (res.skipped.length === res.rowsProcessed && res.metrics.attempts > this.maxRetries) {
        aggregated.batchesFailed++;
      } else {
        aggregated.batchesCompleted++;
      }
    }

    return aggregated;
  }

  private async executeSingleBatchWorker(
    jobId: string,
    batchNumber: number,
    batchRows: CSVRow[],
    startIndex: number
  ): Promise<BatchExecutionResultDTO> {
    const startTime = Date.now();
    let attempts = 0;

    try {
      # Execute AI extraction with exponential backoff retry wrapper
      const aiExtractionResponse = await executeWithBackoff(
        async () => {
          attempts++;
          # Depends on SPEC-0004: AIClient.extractBatch
          return await this.aiEngine.extractBatch(jobId, batchNumber, batchRows);
        },
        {
          maxRetries: this.maxRetries,
          baseDelayMs: 2000,
          maxDelayMs: 16000,
        },
        (attempt, err, delay) => {
          console.warn(`[Batch ${batchNumber}] Attempt ${attempt} failed with status ${err.status}. Retrying in ${delay}ms...`);
        }
      );

      # Validate and normalize AI output using business rules (Depends on SPEC-0005)
      const validationResult = this.validator.validateAndNormalizeBatch(
        aiExtractionResponse.rawRecords,
        batchRows,
        startIndex
      );

      return {
        batchNumber,
        rowsProcessed: batchRows.length,
        imported: validationResult.imported,
        skipped: validationResult.skipped,
        metrics: {
          tokensUsed: aiExtractionResponse.tokensUsed,
          estimatedCostUsd: aiExtractionResponse.estimatedCostUsd,
          attempts,
          executionDurationMs: Date.now() - startTime,
        },
      };
    } catch (error: unknown) {
      # If all retries are exhausted or permanent API error occurs, skip the entire batch safely
      console.error(`[Batch ${batchNumber}] Fatal worker failure after ${attempts} attempts:`, error.message);

      const fallbackSkipped: SkippedRecordDTO[] = batchRows.map((row, idx) => ({
        row_number: startIndex + idx + 1,
        reason: `Batch AI processing failed after ${attempts} attempts: ${error.message || 'Unknown API Error'}`,
        raw_row: row,
      }));

      return {
        batchNumber,
        rowsProcessed: batchRows.length,
        imported: [],
        skipped: fallbackSkipped,
        metrics: {
          tokensUsed: 0,
          estimatedCostUsd: 0,
          attempts,
          executionDurationMs: Date.now() - startTime,
        },
      };
    }
  }
}
```

### Dependencies

- `p-limit` (^5.0.0) — Lightweight, robust concurrency rate-limiter for asynchronous Promise execution.
- Depends directly on `SPEC-0004` (`AIClient`) and `SPEC-0005` (`ResponseValidator`).

### Configuration & Environment Variables

| Variable Name | Layer | Type | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `AI_BATCH_SIZE` | Infrastructure | `number` | `50` | Number of CSV rows packed into a single LLM prompt batch. |
| `MAX_BATCH_RETRIES` | Infrastructure | `number` | `3` | Maximum retry attempts per batch ($2\text{s}, 4\text{s}, 8\text{s}$). |
| `BATCH_CONCURRENCY_LIMIT` | Infrastructure | `number` | `3` | Maximum concurrent OpenAI API requests allowed across a single import job. |

### Performance Considerations

- **Throughput Optimization**: With `AI_BATCH_SIZE = 50` and `BATCH_CONCURRENCY_LIMIT = 3`, the system processes 150 rows concurrently every $\sim 2.5\text{ seconds}$ (typical `GPT-4.1 Mini` batch latency). A 2,500-row CSV completes in roughly $42\text{ seconds}$, comfortably beneath the $55\text{-second}$ Express HTTP timeout (`SPEC-0003`).
- **Memory Footprint**: By processing chunks of 50 rows, the maximum JSON string payload sent to OpenAI remains below $15\text{ KB}$ per request, ensuring zero memory ballooning or string allocation spikes.

### Scalability

If future requirements mandate processing $50,000+$ rows ($1,000+$ batches), `processAllBatches` can be swapped from `Promise.all` over `p-limit` to publishing batch job payloads to a Redis / BullMQ worker queue (`Depends on SPEC-0009`) without altering the `executeSingleBatchWorker` logic or retry mechanics.

---

## Security Considerations

- **API Key Exhaustion & Denial of Wallet**: An attacker uploading a 5,000-row CSV that constantly triggers `HTTP 500` inside OpenAI could double or triple token consumption if retries were unbounded. Enforcing `MAX_BATCH_RETRIES = 3` caps total potential API attempts at $4 \times N_{\text{batches}}$, preventing runaway billing loops.

---

## Testing Strategy

### Unit & Resiliency Tests (`Vitest` + `Nock` / Mock Timers)
- **Deterministic Chunking**: Pass 125 rows with `AI_BATCH_SIZE = 50`. Assert `processAllBatches` creates exactly 3 batches (50, 50, and 25 rows) and preserves `startIndex` correctly ($0, 50, 100$).
- **Exponential Backoff Verification**: Use Vitest fake timers (`vi.useFakeTimers()`). Mock `AIClient.extractBatch` (`Depends on SPEC-0004`) to throw `HTTP 429` twice, then return `200 OK` on attempt 3. Assert that `executeWithBackoff` sleeps exactly $\sim 2000\text{ ms}$, then $\sim 4000\text{ ms}$, and successfully completes without skipping rows.
- **Batch Isolation on Exhaustion**: Mock batch \#2 to throw `HTTP 503` continuously across all 4 attempts ($1 + 3$ retries), while batches \#1 and \#3 succeed. Assert that `processAllBatches` returns HTTP `200 OK` with all 100 rows from batches \#1 and \#3 in `imported`, and exactly 50 rows from batch \#2 in `skipped` with exact reason `Batch AI processing failed after 4 attempts...`.

---

## Observability

- **Structured Batch Telemetry**: Every batch execution emits granular telemetry metrics upon completion:
  ```json
  {
    "event": "batch_worker_completed",
    "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "batchNumber": 2,
    "rowsProcessed": 50,
    "attempts": 2,
    "tokensUsed": 640,
    "durationMs": 3120,
    "status": "SUCCESS"
  }
  ```
- **Rate Limit Alerts**: If `error.status === 429` is caught by `executeWithBackoff`, emit a high-priority warning log `openai_rate_limit_encountered` (`retryAfterSeconds`, `batchNumber`) to alert DevOps of quota saturation.

---

## Rollout Plan

1. Install `p-limit` in `backend/package.json`.
2. Implement `retryEngine.ts` and write comprehensive fake-timer unit tests to verify backoff calculations.
3. Implement `BatchProcessor` service linking `AIClient` (`SPEC-0004`) and `ResponseValidator` (`SPEC-0005`).
4. Integrate `BatchProcessor` into `ImportOrchestrationService` (`SPEC-0003`).

---

## Alternatives Considered

### 1. Synchronous Sequential Batching (`for...of` loop without concurrency)
- **Justification for Rejection**: Executing batches sequentially ($1 \rightarrow 2 \rightarrow 3$) at $2.5\text{ seconds}$ per batch limits throughput to 20 rows per second. A 2,000-row CSV would take $100\text{ seconds}$ to process, exceeding Express HTTP timeouts ($55\text{ s}$) and causing client disconnections. Bounded concurrency ($3$ active workers) triples throughput while respecting API rate limits.

### 2. Full Message Queue (RabbitMQ / BullMQ + Redis) for MVP
- **Justification for Rejection**: While BullMQ handles retries and concurrency natively, requiring Redis as mandatory infrastructure violates the assignment's explicit guidance that auxiliary infrastructure is optional ($> \text{Assignment explicitly allows stateless... cutting these is not a quality compromise... per project architectural goals}$). `p-limit` + `executeWithBackoff` achieves enterprise-grade resilience in memory with zero external dependencies for MVP.

---

## Questions and Concerns

- **Question**: Should `AI_BATCH_SIZE` be dynamically adjusted at runtime if `HTTP 413 Payload Too Large` is returned by OpenAI?
- **Decision**: No. `AI_BATCH_SIZE = 50` rows of CRM lead data consumes at most $\sim 4,000$ tokens, well below `GPT-4.1 Mini`'s $128,000$-token context limit. If a single row contains a $50\text{-page}$ document inside a cell, Zod validation in `SPEC-0003` or client parsing in `SPEC-0002` will reject the oversized cell prior to batch chunking.

---

## References

- [OpenAI Rate Limits & Exponential Backoff Guidance](https://platform.openai.com/docs/guides/rate-limits)
- [p-limit Asynchronous Concurrency Limiter](https://github.com/sindresorhus/p-limit)
- `Depends on SPEC-0003` (`ImportOrchestrationService` entry point)
- `Depends on SPEC-0004` (`AIClient` invocation)
- `Depends on SPEC-0005` (`ResponseValidator` invocation)
