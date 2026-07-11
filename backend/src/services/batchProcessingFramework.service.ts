import { LeadDTO, SkippedRecordDTO } from '../types/lead.js';
import { CSVRow } from '../types/csv.js';
import { createAppError } from '../utils/errors/create-app-error.js';
import { executeWithBackoff } from './utils/retryEngine.js';
import { createConcurrencyPool } from './utils/concurrencyPool.js';
import { AIClient } from './aiExtraction.service.js';
import { ResponseValidator } from './aiValidation.service.js';
import { config } from '../utils/config.js';

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

export interface BatchProcessorOptions {
  batchSize?: number;
  maxRetries?: number;
  concurrencyLimit?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class BatchProcessor {
  private aiEngine: AIClient;
  private validator: ResponseValidator;
  private batchSize: number;
  private maxRetries: number;
  private concurrencyLimit: number;
  private baseDelayMs: number;
  private maxDelayMs: number;

  constructor(
    aiEngine = new AIClient(),
    validator = new ResponseValidator(),
    options?: BatchProcessorOptions
  ) {
    this.aiEngine = aiEngine;
    this.validator = validator;
    this.batchSize = options?.batchSize ?? config.AI_BATCH_SIZE;
    this.maxRetries = options?.maxRetries ?? config.MAX_BATCH_RETRIES;
    this.concurrencyLimit = options?.concurrencyLimit ?? config.BATCH_CONCURRENCY_LIMIT;
    this.baseDelayMs = options?.baseDelayMs ?? 2000;
    this.maxDelayMs = options?.maxDelayMs ?? 16000;
  }

  public async processAllBatches(
    jobId: string,
    rows: CSVRow[]
  ): Promise<AggregatedImportResultDTO> {
    const batches: { batchNumber: number; rows: CSVRow[]; startIndex: number }[] = [];

    // 1. Chunk array deterministically
    for (let i = 0; i < rows.length; i += this.batchSize) {
      batches.push({
        batchNumber: Math.floor(i / this.batchSize) + 1,
        rows: rows.slice(i, i + this.batchSize),
        startIndex: i,
      });
    }

    // 2. Initialize concurrency limiter
    const limit = createConcurrencyPool(this.concurrencyLimit);

    // 3. Schedule all workers
    const batchPromises = batches.map((batch) =>
      limit(() =>
        this.executeSingleBatchWorker(jobId, batch.batchNumber, batch.rows, batch.startIndex)
      )
    );

    const results = await Promise.all(batchPromises);

    // 4. Aggregate results across all batches
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

  public async executeSingleBatchWorker(
    jobId: string,
    batchNumber: number,
    batchRows: CSVRow[],
    startIndex: number
  ): Promise<BatchExecutionResultDTO> {
    const startTime = Date.now();
    let attempts = 0;

    try {
      // Execute AI extraction with exponential backoff retry wrapper
      const aiExtractionResponse = await executeWithBackoff(
        async () => {
          attempts++;
          return await this.aiEngine.extractBatch(jobId, batchNumber, batchRows);
        },
        {
          maxRetries: this.maxRetries,
          baseDelayMs: this.baseDelayMs,
          maxDelayMs: this.maxDelayMs,
        },
        (attempt, err, delay) => {
          const errObj = (typeof err === 'object' && err !== null ? err : {}) as Record<
            string,
            unknown
          >;
          const status =
            typeof errObj.status === 'number'
              ? errObj.status
              : typeof errObj.statusCode === 'number'
                ? errObj.statusCode
                : 'UNKNOWN';
          console.warn(
            `[Batch ${batchNumber}] Attempt ${attempt} failed with status ${status}. Retrying in ${delay}ms...`
          );
        }
      );

      // Validate and normalize AI output using business rules
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
      const errObj = (typeof error === 'object' && error !== null ? error : {}) as Record<
        string,
        unknown
      >;
      const status =
        typeof errObj.status === 'number'
          ? errObj.status
          : typeof errObj.statusCode === 'number'
            ? errObj.statusCode
            : undefined;
      const message = typeof errObj.message === 'string' ? errObj.message : 'Unknown API Error';

      // If permanent authentication error occurs (401/403), abort batch immediately and halt entire job
      if (status === 401 || status === 403) {
        throw createAppError('OPENAI_AUTH_FAILED', `OpenAI authentication failed: ${message}`, status);
      }

      // If prompt is rejected due to payload size or invalid structure (400/413)
      let reason: string;
      if (status === 400 || status === 413) {
        reason = 'BATCH_API_PAYLOAD_REJECTED';
      } else if (attempts > this.maxRetries) {
        reason = 'OPENAI_SERVICE_UNAVAILABLE_AFTER_RETRIES';
      } else {
        reason = `Batch AI processing failed after ${attempts} attempts: ${message}`;
      }

      console.error(
        `[Batch ${batchNumber}] Fatal worker failure after ${attempts} attempts:`,
        message
      );

      const fallbackSkipped: SkippedRecordDTO[] = batchRows.map((row, idx) => ({
        row_number: startIndex + idx + 1,
        reason,
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
