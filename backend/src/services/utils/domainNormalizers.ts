/**
 * Normalizes phone numbers by stripping non-numeric characters.
 * Ensures clean 10-digit primary mobile storage.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  // If 12+ digits with country code e.g. 919876543210, extract last 10 digits
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Ensures created_at is valid for `new Date(created_at)`.
 * Falls back to current UTC timestamp if malformed or missing.
 */
export function normalizeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString();
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

/**
 * Escapes raw literal line breaks (\r, \n) into CSV-safe string sequences (\n)
 * preventing downstream RFC 4180 CSV export corruption.
 */
export function sanitizeCsvText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .trim();
}
