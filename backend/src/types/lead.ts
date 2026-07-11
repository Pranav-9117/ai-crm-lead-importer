import { CRMStatusEnum, DataSourceEnum } from './enums.js';
import { CSVRow } from './csv.js';

/**
 * Standardized GrowEasy CRM Lead Record (Stateless Transient Payload).
 */
export interface LeadDTO {
  name: string | null;                     // Lead full name
  email: string | null;                    // First valid email found
  country_code: string | null;             // E.g., "+91" or "+1"
  mobile_without_country_code: string | null; // 10-digit primary mobile number
  company: string | null;                  // Organization or employer
  city: string | null;
  state: string | null;
  country: string | null;
  lead_owner: string | null;               // Assigned representative name or ID
  crm_status: CRMStatusEnum | null;        // Strict enum match
  crm_note: string;                        // Catch-all for remarks, overflow emails/mobiles
  data_source: DataSourceEnum | "";        // Strict enum match or empty string ""
  possession_time: string | null;          // Timeline string e.g. "Immediate", "6 months"
  description: string | null;              // General background or inquiry text
  created_at: string;                      // ISO 8601 string parseable by `new Date()`. If the source CSV does not contain a valid timestamp, the backend generates an ISO 8601 timestamp during normalization.
}

/**
 * Record skipped due to business rules (e.g. neither email nor mobile present).
 */
export interface SkippedRecordDTO {
  row_number: number;                      // 1-indexed original CSV row number
  reason: string;                          // Explanation (e.g. "Missing both primary email and mobile number")
  raw_row: CSVRow;                         // Original unparsed CSV key-value map
}

/**
 * Simplified stateless payload returned by POST /api/import to the frontend.
 */
export interface ImportResponseDTO {
  importedRecords: LeadDTO[];
  skippedRecords: SkippedRecordDTO[];
  summary: {
    totalRows: number;
    imported: number;
    skipped: number;
    processingTimeMs: number;
  };
}
