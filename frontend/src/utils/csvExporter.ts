import { LeadDTO, SkippedRecordDTO } from '../types/lead';

/**
 * Escapes a single cell string according to RFC 4180 specification.
 * 1. Converts literal multi-line line breaks (\r, \n) into escaped \n sequences.
 * 2. If the cell contains commas (,), quotes ("), or escaped line breaks, encloses the string in double quotes.
 * 3. Escapes any internal double quotes as two double quotes ("").
 */
export function formatCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val);

  // Ensure any literal line breaks are converted to escaped \n text
  str = str.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\n');

  const requiresQuotes = str.includes(',') || str.includes('"') || str.includes('\\n');
  if (requiresQuotes) {
    // Double-quote internal quotes: " -> ""
    const escapedQuotes = str.replace(/"/g, '""');
    return `"${escapedQuotes}"`;
  }
  return str;
}

/**
 * Exports an array of LeadDTO records into an RFC 4180 compliant CSV file and triggers browser download.
 */
export function downloadProcessedCsv(leads: LeadDTO[], filename = 'processed_crm_leads.csv'): void {
  if (leads.length === 0) return;

  // Canonical CSV Headers
  const headers: (keyof LeadDTO)[] = [
    'name',
    'email',
    'country_code',
    'mobile_without_country_code',
    'company',
    'city',
    'state',
    'country',
    'lead_owner',
    'crm_status',
    'crm_note',
    'data_source',
    'possession_time',
    'description',
    'created_at',
  ];

  const headerRow = headers.map((h) => formatCsvCell(h)).join(',');
  const dataRows = leads.map((lead) => headers.map((col) => formatCsvCell(lead[col])).join(','));

  const csvContent = [headerRow, ...dataRows].join('\r\n'); // Strict CRLF line separation per RFC 4180

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports skipped records to CSV including exact row_number, reason, and serialized raw_row JSON.
 */
export function downloadSkippedCsv(skipped: SkippedRecordDTO[], filename = 'skipped_crm_records.csv'): void {
  if (skipped.length === 0) return;

  const headers = ['row_number', 'reason', 'raw_row_json'];
  const headerRow = headers.map((h) => formatCsvCell(h)).join(',');
  const dataRows = skipped.map((s) => [
    formatCsvCell(s.row_number),
    formatCsvCell(s.reason),
    formatCsvCell(JSON.stringify(s.raw_row)),
  ].join(','));

  const csvContent = [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
