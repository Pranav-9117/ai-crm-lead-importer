import { LeadDTO, SkippedRecordDTO } from '../types/lead.js';
import { CSVRow } from '../types/csv.js';
import { AIOutputRowSchema } from './utils/validationSchemas.js';
import { normalizePhone, normalizeDate, sanitizeCsvText } from './utils/domainNormalizers.js';

export interface BatchValidationResultDTO {
  imported: LeadDTO[];
  skipped: SkippedRecordDTO[];
}

export class ResponseValidator {
  /**
   * Validates and normalizes an array of raw AI JSON outputs against original CSV rows.
   */
  public validateAndNormalizeBatch(
    rawAiRecords: Record<string, unknown>[],
    originalRows: CSVRow[],
    startIndex: number
  ): BatchValidationResultDTO {
    const imported: LeadDTO[] = [];
    const skipped: SkippedRecordDTO[] = [];

    const totalItems = Math.max(rawAiRecords.length, originalRows.length);

    let enumCoercionsCount = 0;
    let dateNormalizationsCount = 0;

    for (let i = 0; i < totalItems; i++) {
      const rawAi = rawAiRecords[i] || {};
      const rawRow = originalRows[i] || {};
      const rowNumber = startIndex + i + 1;

      // 1. Zod Schema Coercion
      const parseResult = AIOutputRowSchema.safeParse(rawAi);

      if (!parseResult.success) {
        skipped.push({
          row_number: rowNumber,
          reason: 'AI generated structural schema mismatch or corrupted properties',
          raw_row: rawRow,
        });
        continue;
      }

      const coerced = parseResult.data;

      // Track enum coercions for telemetry
      if (
        (rawAi.crm_status !== undefined && rawAi.crm_status !== null && coerced.crm_status === null) ||
        (rawAi.data_source !== undefined && rawAi.data_source !== null && coerced.data_source === null)
      ) {
        enumCoercionsCount++;
      }

      // Track date normalization for telemetry
      const rawDateStr = typeof rawAi.created_at === 'string' ? rawAi.created_at : null;
      const cleanDate = normalizeDate(coerced.created_at);
      if (!rawDateStr || isNaN(new Date(rawDateStr).getTime())) {
        dateNormalizationsCount++;
      }

      // 2. Domain Normalization
      const cleanEmail = coerced.email || null;
      const cleanPhone = normalizePhone(coerced.mobile_without_country_code);
      const cleanNote = sanitizeCsvText(coerced.crm_note);
      const cleanDesc = coerced.description ? sanitizeCsvText(coerced.description) : null;

      // 3. Mandatory Skip Rule Evaluation (Per Project Business Rules)
      // Skip if NEITHER email NOR mobile is present
      if (!cleanEmail && !cleanPhone) {
        skipped.push({
          row_number: rowNumber,
          reason: 'Missing both primary email and mobile number',
          raw_row: rawRow,
        });
        continue;
      }

      // 4. Construct Canonical LeadDTO (Stateless without DB identifiers)
      const lead: LeadDTO = {
        name: coerced.name || null,
        email: cleanEmail,
        country_code: coerced.country_code || (cleanPhone ? '+91' : null),
        mobile_without_country_code: cleanPhone,
        company: coerced.company || null,
        city: coerced.city || null,
        state: coerced.state || null,
        country: coerced.country || 'India',
        lead_owner: coerced.lead_owner || null,
        crm_status: coerced.crm_status, // Already strictly enum-checked by Zod
        crm_note: cleanNote,
        data_source: coerced.data_source, // Already strictly enum-checked by Zod
        possession_time: coerced.possession_time || null,
        description: cleanDesc,
        created_at: cleanDate,
      };

      imported.push(lead);
    }

    // Emit telemetry log summarizing normalization metrics
    console.log(
      JSON.stringify({
        event: 'batch_validation_completed',
        totalProcessed: totalItems,
        importedCount: imported.length,
        skippedCount: skipped.length,
        enumCoercionsCount,
        dateNormalizationsCount,
      })
    );

    return { imported, skipped };
  }
}
