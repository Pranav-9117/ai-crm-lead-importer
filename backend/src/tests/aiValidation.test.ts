import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResponseValidator } from '../services/aiValidation.service.js';
import { AIOutputRowSchema } from '../services/utils/validationSchemas.js';
import {
  normalizePhone,
  normalizeDate,
  sanitizeCsvText,
} from '../services/utils/domainNormalizers.js';
import { CRMStatusEnum, DataSourceEnum } from '../types/enums.js';
import { CSVRow } from '../types/csv.js';

describe('SPEC-0005: AI Response Validation & Domain Normalization', () => {
  describe('1. Domain Normalizers (`domainNormalizers.ts`)', () => {
    it('normalizePhone should strip non-numeric characters and handle +91 10-digit extraction', () => {
      expect(normalizePhone('+91 (987) 654-3210')).toBe('9876543210');
      expect(normalizePhone('919876543210')).toBe('9876543210');
      expect(normalizePhone('9876543210')).toBe('9876543210');
      expect(normalizePhone('abc')).toBeNull();
      expect(normalizePhone('')).toBeNull();
      expect(normalizePhone(null)).toBeNull();
    });

    it('sanitizeCsvText should escape raw literal line breaks (\\r, \\n) to \\n sequence', () => {
      const input =
        'Called user on Monday.\r\nUser asked for call back on Friday.\nBudget: $500k.';
      const expected =
        'Called user on Monday.\\nUser asked for call back on Friday.\\nBudget: $500k.';
      expect(sanitizeCsvText(input)).toBe(expected);
      expect(sanitizeCsvText(null)).toBe('');
      expect(sanitizeCsvText(undefined)).toBe('');
    });

    it('normalizeDate should ensure valid ISO 8601 strings and fallback to current time when malformed or missing', () => {
      const validIso = '2026-07-11T10:00:00.000Z';
      expect(normalizeDate(validIso)).toBe(validIso);

      const invalidDate = normalizeDate('yesterday afternoon');
      expect(new Date(invalidDate).getTime()).not.toBeNaN();

      const missingDate = normalizeDate(null);
      expect(new Date(missingDate).getTime()).not.toBeNaN();
    });
  });

  describe('2. Zod Validation Schemas (`validationSchemas.ts`)', () => {
    it('should coerce valid CRM status and data source enums exactly', () => {
      const input = {
        crm_status: CRMStatusEnum.GOOD_LEAD_FOLLOW_UP,
        data_source: DataSourceEnum.LEADS_ON_DEMAND,
      };
      const parsed = AIOutputRowSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.crm_status).toBe(CRMStatusEnum.GOOD_LEAD_FOLLOW_UP);
        expect(parsed.data.data_source).toBe(DataSourceEnum.LEADS_ON_DEMAND);
      }
    });

    it('should nullify invalid CRM status and data source enums safely (Enum Nullification Check)', () => {
      const input = {
        crm_status: 'SUPER_HOT',
        data_source: 'internal_excel',
      };
      const parsed = AIOutputRowSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.crm_status).toBeNull();
        expect(parsed.data.data_source).toBeNull();
      }
    });

    it('should preprocess numeric mobile_without_country_code safely', () => {
      const input = {
        mobile_without_country_code: 9876543210,
      };
      const parsed = AIOutputRowSchema.safeParse(input);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.mobile_without_country_code).toBe('9876543210');
      }
    });
  });

  describe('3. Core AI Validation Service (`ResponseValidator`)', () => {
    let validator: ResponseValidator;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.clearAllMocks();
      validator = new ResponseValidator();
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should enforce Skip Rule (Record A: has email only, Record B: has mobile only, Record C: missing both)', () => {
      const rawAiRecords = [
        {
          name: 'Lead A',
          email: 'test@abc.com',
          mobile_without_country_code: null,
        },
        {
          name: 'Lead B',
          email: null,
          mobile_without_country_code: '9876543210',
        },
        {
          name: 'Lead C',
          email: null,
          mobile_without_country_code: 'N/A', // normalizePhone will return null
        },
      ];

      const originalRows: CSVRow[] = [
        { Name: 'Lead A', Email: 'test@abc.com' },
        { Name: 'Lead B', Mobile: '9876543210' },
        { Name: 'Lead C', Email: '', Mobile: 'N/A' },
      ];

      const result = validator.validateAndNormalizeBatch(rawAiRecords, originalRows, 0);

      expect(result.imported).toHaveLength(2);
      expect(result.imported[0].name).toBe('Lead A');
      expect(result.imported[0].email).toBe('test@abc.com');
      expect(result.imported[0].mobile_without_country_code).toBeNull();

      expect(result.imported[1].name).toBe('Lead B');
      expect(result.imported[1].mobile_without_country_code).toBe('9876543210');
      expect(result.imported[1].country_code).toBe('+91'); // Default check

      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].row_number).toBe(3);
      expect(result.skipped[0].reason).toBe('Missing both primary email and mobile number');
      expect(result.skipped[0].raw_row).toEqual({ Name: 'Lead C', Email: '', Mobile: 'N/A' });
    });

    it('should skip records on structural JSON mismatch or corrupted schema properties', () => {
      const rawAiRecords = [
        // Invalid structural data (e.g., crm_note is not string and transform fails or something unparseable)
        {
          name: 12345, // invalid type
        } as unknown as Record<string, unknown>,
      ];

      const originalRows: CSVRow[] = [{ Name: 'Bad Structure' }];

      const result = validator.validateAndNormalizeBatch(rawAiRecords, originalRows, 10);

      expect(result.imported).toHaveLength(0);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].row_number).toBe(11);
      expect(result.skipped[0].reason).toBe(
        'AI generated structural schema mismatch or corrupted properties'
      );
    });

    it('should emit structured telemetry audit log upon batch validation completion', () => {
      const rawAiRecords = [
        {
          email: 'telemetry@test.com',
          crm_status: 'INVALID_STATUS',
          created_at: 'bad-timestamp',
        },
      ];
      const originalRows: CSVRow[] = [{ Email: 'telemetry@test.com' }];

      validator.validateAndNormalizeBatch(rawAiRecords, originalRows, 0);

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const logPayload = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logPayload).toEqual({
        event: 'batch_validation_completed',
        totalProcessed: 1,
        importedCount: 1,
        skippedCount: 0,
        enumCoercionsCount: 1,
        dateNormalizationsCount: 1,
      });
    });
  });
});
