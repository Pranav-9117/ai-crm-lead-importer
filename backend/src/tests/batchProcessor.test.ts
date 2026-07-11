import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatchProcessor } from '../services/batchProcessingFramework.service.js';
import { AIClient } from '../services/aiExtraction.service.js';
import { ResponseValidator } from '../services/aiValidation.service.js';
import { executeWithBackoff } from '../services/utils/retryEngine.js';
import { CSVRow } from '../types/csv.js';
import { config } from '../utils/config.js';

describe('Batch Processing & Retry Framework', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('1. Deterministic Chunking', () => {
    it('should split 125 rows into exactly 3 batches (50, 50, 25) maintaining exact startIndex (0, 50, 100)', async () => {
      const mockAiClient = new AIClient();
      const mockValidator = new ResponseValidator();

      const extractedIndices: { batchNumber: number; startIndex: number; rowCount: number }[] = [];

      vi.spyOn(mockAiClient, 'extractBatch').mockImplementation(async (jobId, batchNum, rows) => {
        return {
          rawRecords: rows.map(() => ({})),
          tokensUsed: 10,
          estimatedCostUsd: 0.001,
        };
      });

      vi.spyOn(mockValidator, 'validateAndNormalizeBatch').mockImplementation(
        (rawAiRecords, originalRows, startIndex) => {
          extractedIndices.push({
            batchNumber: Math.floor(startIndex / config.AI_BATCH_SIZE) + 1,
            startIndex,
            rowCount: originalRows.length,
          });
          return {
            imported: originalRows.map((_, i) => ({
              name: `Lead ${startIndex + i}`,
              email: null,
              country_code: null,
              mobile_without_country_code: null,
              company: null,
              city: null,
              state: null,
              country: null,
              lead_owner: null,
              crm_status: null,
              crm_note: '',
              data_source: "",
              possession_time: null,
              description: null,
              created_at: new Date().toISOString(),
            })),
            skipped: [],
          };
        }
      );

      const processor = new BatchProcessor(mockAiClient, mockValidator);
      const rows: CSVRow[] = Array.from({ length: 125 }, (_, idx) => ({ id: `${idx + 1}` }));

      const result = await processor.processAllBatches('test-job-id', rows);

      // Verify batch counts and structure
      expect(result.batchesCompleted).toBe(3);
      expect(result.batchesFailed).toBe(0);
      expect(result.imported.length).toBe(125);
      expect(result.skipped.length).toBe(0);

      // Sort by batchNumber to verify order independent of async completion
      extractedIndices.sort((a, b) => a.batchNumber - b.batchNumber);

      expect(extractedIndices).toEqual([
        { batchNumber: 1, startIndex: 0, rowCount: 50 },
        { batchNumber: 2, startIndex: 50, rowCount: 50 },
        { batchNumber: 3, startIndex: 100, rowCount: 25 },
      ]);
    });
  });

  describe('2. Exponential Backoff Verification (`retryEngine.ts`)', () => {
    it('should retry transient HTTP 429 errors with exponential backoff (2000ms -> 4000ms) + jitter and succeed on attempt 3', async () => {
      vi.useFakeTimers();

      let attempts = 0;
      const operation = vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw { status: 429, message: 'Rate limit exceeded' };
        }
        if (attempts === 2) {
          throw { status: 429, message: 'Rate limit exceeded again' };
        }
        return 'SUCCESS';
      });

      const retryPromise = executeWithBackoff(operation, {
        maxRetries: 3,
        baseDelayMs: 2000,
        maxDelayMs: 16000,
      });

      // Advance timers across backoff attempts
      // First backoff ~2000ms + jitter (up to 500ms)
      await vi.advanceTimersByTimeAsync(2600);
      expect(attempts).toBe(2);

      // Second backoff ~4000ms + jitter (up to 500ms)
      await vi.advanceTimersByTimeAsync(4600);
      expect(attempts).toBe(3);

      const result = await retryPromise;
      expect(result).toBe('SUCCESS');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should immediately throw non-transient errors (e.g., HTTP 400 or 401) without retrying', async () => {
      const operation = vi.fn().mockRejectedValue({ status: 400, message: 'Bad Request' });

      await expect(
        executeWithBackoff(operation, {
          maxRetries: 3,
          baseDelayMs: 2000,
          maxDelayMs: 16000,
        })
      ).rejects.toMatchObject({ status: 400 });

      expect(operation).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Batch Isolation on Exhaustion', () => {
    it('should isolate a batch that fails all retries without discarding successful batches (#1 and #3 succeed, #2 fails after 4 attempts)', async () => {
      const mockAiClient = new AIClient();
      const mockValidator = new ResponseValidator();

      vi.spyOn(mockAiClient, 'extractBatch').mockImplementation(async (jobId, batchNum, rows) => {
        if (batchNum === 2) {
          throw { status: 503, message: 'Service Unavailable' };
        }
        return {
          rawRecords: rows.map(() => ({})),
          tokensUsed: 100,
          estimatedCostUsd: 0.01,
        };
      });

      vi.spyOn(mockValidator, 'validateAndNormalizeBatch').mockImplementation(
        (rawAiRecords, originalRows, startIndex) => {
          return {
            imported: originalRows.map((_, i) => ({
              name: `Lead from batch ${Math.floor(startIndex / config.AI_BATCH_SIZE) + 1}`,
              email: null,
              country_code: null,
              mobile_without_country_code: null,
              company: null,
              city: null,
              state: null,
              country: null,
              lead_owner: null,
              crm_status: null,
              crm_note: '',
              data_source: "",
              possession_time: null,
              description: null,
              created_at: new Date().toISOString(),
            })),
            skipped: [],
          };
        }
      );

      // Use processor with fast baseDelayMs in test so it completes without fake timers needed for whole job
      const processor = new BatchProcessor(mockAiClient, mockValidator, {
        baseDelayMs: 10,
        maxDelayMs: 50,
      });
      // Override maxRetries to 3 (which means 1 initial attempt + 3 retries = 4 total attempts)
      const rows: CSVRow[] = Array.from({ length: 150 }, (_, idx) => ({ id: `${idx + 1}` }));

      const result = await processor.processAllBatches('test-job-id', rows);

      // Batch #1 (50 rows) + Batch #3 (50 rows) = 100 imported rows
      expect(result.imported.length).toBe(100);
      // Batch #2 (50 rows) skipped due to exhaustion
      expect(result.skipped.length).toBe(50);
      expect(result.batchesCompleted).toBe(2);
      expect(result.batchesFailed).toBe(1);

      // Check reason string format for skipped records from Batch #2
      for (const skippedRecord of result.skipped) {
        expect(skippedRecord.reason).toBe('OPENAI_SERVICE_UNAVAILABLE_AFTER_RETRIES');
      }
    });
  });

  describe('4. Authentication Failure Halt (`OPENAI_AUTH_FAILED`)', () => {
    it('should immediately throw an AppError with code OPENAI_AUTH_FAILED when encountering HTTP 401', async () => {
      const mockAiClient = new AIClient();
      const mockValidator = new ResponseValidator();

      vi.spyOn(mockAiClient, 'extractBatch').mockRejectedValue({
        status: 401,
        message: 'Invalid API Key',
      });

      const processor = new BatchProcessor(mockAiClient, mockValidator);
      const rows: CSVRow[] = Array.from({ length: 50 }, (_, idx) => ({ id: `${idx + 1}` }));

      await expect(
        processor.executeSingleBatchWorker('test-job-id', 1, rows, 0)
      ).rejects.toMatchObject({
        code: 'OPENAI_AUTH_FAILED',
        statusCode: 401,
      });
    });
  });
});
