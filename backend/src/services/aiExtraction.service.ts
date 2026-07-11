import { CSVRow } from '../types/csv.js';

export interface AIExtractionResponseDTO {
  rawRecords: Record<string, unknown>[];
  tokensUsed: number;
  estimatedCostUsd: number;
}

/**
 * Placeholder AI Extraction Engine stub representing SPEC-0004 contract.
 * Full implementation will be added during SPEC-0004 execution.
 */
export class AIExtractionEngine {
  public async extractBatch(
    jobId: string,
    batchNumber: number,
    rows: CSVRow[]
  ): Promise<AIExtractionResponseDTO> {
    // Placeholder return until SPEC-0004 is implemented
    return {
      rawRecords: rows.map(() => ({})),
      tokensUsed: 0,
      estimatedCostUsd: 0,
    };
  }
}

// Alias AIExtractionEngine as AIClient to support both SPEC-0004 and SPEC-0006 naming conventions
export { AIExtractionEngine as AIClient };
