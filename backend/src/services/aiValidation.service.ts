import { LeadDTO, SkippedRecordDTO } from '../types/lead.js';
import { CSVRow } from '../types/csv.js';

export interface BatchValidationResultDTO {
  imported: LeadDTO[];
  skipped: SkippedRecordDTO[];
}

/**
 * Placeholder AI Response Validator stub representing SPEC-0005 contract.
 * Full implementation will be added during SPEC-0005 execution.
 */
export class ResponseValidator {
  /**
   * Validates and normalizes an array of raw AI JSON outputs against original CSV rows.
   */
  public validateAndNormalizeBatch(
    rawAiRecords: Record<string, unknown>[],
    originalRows: CSVRow[],
    startIndex: number
  ): BatchValidationResultDTO {
    // Placeholder return until SPEC-0005 is implemented
    return {
      imported: [],
      skipped: [],
    };
  }
}
