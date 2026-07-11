import crypto from 'node:crypto';
import { ImportResponseDTO } from '../types/lead.js';
import { CSVRow } from '../types/csv.js';
import { BatchProcessor } from './batchProcessingFramework.service.js';

/**
 * The service representing the application entry point for import processing.
 * Orchestrates batch execution via BatchProcessor (SPEC-0006).
 */
export class ImportService {
  private batchProcessor: BatchProcessor;

  constructor(batchProcessor = new BatchProcessor()) {
    this.batchProcessor = batchProcessor;
  }

  public async executeImport(rows: CSVRow[]): Promise<ImportResponseDTO> {
    const startTime = Date.now();
    const jobId = crypto.randomUUID();

    const result = await this.batchProcessor.processAllBatches(jobId, rows);

    const processingTimeMs = Date.now() - startTime;

    return {
      importedRecords: result.imported,
      skippedRecords: result.skipped,
      summary: {
        totalRows: rows.length,
        imported: result.imported.length,
        skipped: result.skipped.length,
        processingTimeMs,
      },
    };
  }
}

