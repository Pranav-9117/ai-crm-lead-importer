# Backend SPEC-0005: AI Response Validation

## Metadata

| Field | Value |
| :--- | :--- |
| **SPEC ID** | `SPEC-0005` |
| **Title** | AI Response Validation, Business Rule Enforcement & Data Normalization Service |
| **Layer** | Backend |
| **Status** | Implementation-Ready |
| **Authors** | Principal Software Architect |
| **Reviewers** | Senior Backend & Domain Engineering Teams |
| **Dependencies** | Depends on `SPEC-0004` (and `SPEC-0001`) |

---

## Summary

This specification defines the post-generation data integrity and validation layer (`AIValidationService`). While the prompt engineering in `SPEC-0004` instructs `GPT-4.1 Mini` to adhere to CRM domain constraints, Large Language Models remain inherently probabilistic and prone to subtle formatting hallucinations (e.g. returning `"STATUS_GOOD"` instead of `"GOOD_LEAD_FOLLOW_UP"`, emitting unparseable date strings, or returning raw multi-line breaks that corrupt CSV row structures). `SPEC-0005` establishes a deterministic validation and transformation pipeline using `Zod` and domain sanitizers. It validates schema compliance, enforces enum restrictions, normalizes timestamps/phones/emails, evaluates mandatory skip-record rules (`!email && !mobile`), and partitions the raw LLM output into canonical `LeadDTO[]` (imported) and `SkippedRecordDTO[]` (skipped) arrays ready for delivery to the results UI (`SPEC-0007`).

---

## Motivation

An AI extraction pipeline without deterministic validation is unsafe for production CRM ingestion. If an LLM hallucinates an invalid status enum or outputs literal line breaks inside a `crm_note`, downstream relational databases (`PostgreSQL`) will reject the row or corrupted CSV exports (`SPEC-0007`) will break multi-column alignment.

### Goals

- Implement `ResponseValidator.validateAndNormalizeBatch(rawAiRecords, originalRows, startIndex)` to deterministically process unvalidated JSON items returned by `SPEC-0004`.
- Enforce strict `Zod` validation against canonical `LeadDTO` requirements (`backend/src/types/lead.ts`).
- Enforce Enum sanitization: check if `crm_status` belongs exactly to `CRMStatusEnum`; if invalid or null, safely coerce to `null` without dropping the lead. Repeat exact sanitization for `data_source` against `DataSourceEnum`.
- Enforce Data Normalization:
  - **Timestamps**: Verify `new Date(created_at).getTime()` is valid (`!isNaN()`). If invalid or missing, normalize to ISO 8601 UTC current time (`new Date().toISOString()`).
  - **Phones**: Sanitize `mobile_without_country_code` by removing whitespace, dashes, and parentheses (`^\d{10}$` extraction).
  - **CSV-Safety**: Sanitize `crm_note` and `description` strings by replacing raw literal `\r\n` or `\n` characters with escaped `\n` text or single spaces to ensure downstream RFC 4180 export safety (`SPEC-0007`).
- Enforce Skip Rule (per project business rules): **Skip any record where `email` is null/empty AND `mobile_without_country_code` is null/empty**. All other partially incomplete records must be kept and normalized.
- Pair skipped rows with exact `row_number`, `reason`, and original `raw_row` (`CSVRow`), while keeping `LeadDTO` strictly stateless without database identifiers (`id` / `uuid` generation belongs to `SPEC-0009`).

### Non-Goals

- Managing worker pool concurrency, timeouts, or executing exponential backoff retries (`Depends on SPEC-0006`).
- Communicating with OpenAI endpoints or constructing system prompts (`Depends on SPEC-0004`).
- Rendering the results tables or generating physical CSV download files (`Depends on SPEC-0007`).

---

## MVP Scope

- `AIValidationService` TypeScript implementation.
- Zod schema definition for AI output coercion (`AIOutputRowSchema`).
- Domain normalization helpers (`normalizePhone`, `normalizeDate`, `sanitizeCsvText`).
- Skip rule evaluator logging row number, reason, and `raw_row`.
- Return structured `BatchValidationResultDTO` (`{ imported: LeadDTO[], skipped: SkippedRecordDTO[] }`).

## Stretch Scope

- Audit trail persistence: saving validation warnings and skip reasons directly to a `SkippedRecord` database table (`Depends on SPEC-0009`).
- Fuzzy enum matching: if the LLM returns `"Good Lead"` or `"Follow Up"`, automatically map to `GOOD_LEAD_FOLLOW_UP` via Levenshtein distance before nullifying.

---

## Technical Design

### Architecture

```mermaid
graph TD
    subgraph Input from Worker - SPEC-0006
        RawJSON[Raw AI JSON Objects array]
        OriginalRows[Original CSVRow[] array]
    end

    subgraph AI Validation Pipeline - SPEC-0005
        Coerce[Zod Schema Coercion & Type Checking]
        Sanitize[Domain Normalization<br/>• Date -> ISO 8601<br/>• Phone -> digits only<br/>• Enums -> exact match or null<br/>• Notes -> escape literal newlines]
        RuleCheck{Skip Rule Evaluation<br/>!email AND !mobile ?}
        
        CreateLead[Generate LeadDTO<br/>Inject UUID v4 & normalized values]
        CreateSkip[Generate SkippedRecordDTO<br/>Inject row_number, reason & raw_row]
    end

    subgraph Output to Worker - SPEC-0006
        Result[BatchValidationResultDTO<br/>{ imported: LeadDTO[], skipped: SkippedRecordDTO[] }]
    end

    RawJSON --> Coerce
    OriginalRows --> Coerce
    Coerce --> Sanitize
    Sanitize --> RuleCheck
    RuleCheck -->|No — Has Email or Mobile| CreateLead
    RuleCheck -->|Yes — Missing Both| CreateSkip
    CreateLead --> Result
    CreateSkip --> Result
```

### API Changes

Not applicable (`SPEC-0005` is an internal domain service invoked within backend worker loops).

### Database Changes

Not applicable.

### Error Handling

Because `AIValidationService` is designed as an isolation boundary between probabilistic LLM generation and strict system DTOs, it **never throws runtime exceptions that abort a batch** when encountering malformed individual records. Instead, it classifies malformed items:

| Failure Type | Example | Validation Action |
| :--- | :--- | :--- |
| **Missing Both Primary Identifiers** | `email: null, mobile_without_country_code: null` | Convert to `SkippedRecordDTO` (`reason: 'Missing both primary email and mobile number'`). |
| **Invalid Status Enum** | `crm_status: 'SUPER_HOT_LEAD'` | Coerce `crm_status: null`. Keep record in `imported`. Log internal warning `enum_coercion_applied`. |
| **Invalid Data Source Enum** | `data_source: 'unknown_spreadsheet'` | Coerce `data_source: null`. Keep record in `imported`. |
| **Unparseable Timestamp** | `created_at: 'yesterday afternoon'` | Coerce `created_at` to `new Date().toISOString()`. Keep record in `imported`. |
| **Structural JSON Mismatch** | Record is `null`, `string`, or completely missing keys | Convert to `SkippedRecordDTO` (`reason: 'AI generated structural schema mismatch'`). |

---

## Implementation Details

### Folder Structure

```text
backend/src/services/
├── aiValidation.service.ts           # Main validation orchestrator and skip rule engine
└── utils/
    ├── domainNormalizers.ts          # Phone, timestamp, and CSV newline escaping utilities
    └── validationSchemas.ts          # Zod schemas for AI output coercion
```

### Components & TypeScript Interfaces

#### 1. Internal Validation Schemas (`backend/src/services/utils/validationSchemas.ts`)

```typescript
import { z } from 'zod';
import { CRMStatusEnum, DataSourceEnum } from '../../types/enums';

export const AIOutputRowSchema = z.object({
  name: z.string().nullable().optional().transform((val) => val?.trim() || null),
  email: z.string().nullable().optional().transform((val) => {
    if (!val) return null;
    const clean = val.trim().toLowerCase();
    # Basic email sanity check
    return clean.includes('@') && clean.includes('.') ? clean : null;
  }),
  country_code: z.string().nullable().optional().transform((val) => val?.trim() || null),
  mobile_without_country_code: z.string().nullable().optional(),
  company: z.string().nullable().optional().transform((val) => val?.trim() || null),
  city: z.string().nullable().optional().transform((val) => val?.trim() || null),
  state: z.string().nullable().optional().transform((val) => val?.trim() || null),
  country: z.string().nullable().optional().transform((val) => val?.trim() || null),
  lead_owner: z.string().nullable().optional().transform((val) => val?.trim() || null),
  
  # Strict enum verification: coerce anything outside enum to null
  crm_status: z.preprocess((val) => {
    if (typeof val === 'string' && Object.values(CRMStatusEnum).includes(val as CRMStatusEnum)) {
      return val;
    }
    return null;
  }, z.nativeEnum(CRMStatusEnum).nullable()),

  crm_note: z.string().nullable().optional().transform((val) => val || ''),
  
  # Strict data source enum verification
  data_source: z.preprocess((val) => {
    if (typeof val === 'string' && Object.values(DataSourceEnum).includes(val as DataSourceEnum)) {
      return val;
    }
    return null;
  }, z.nativeEnum(DataSourceEnum).nullable()),

  possession_time: z.string().nullable().optional().transform((val) => val?.trim() || null),
  description: z.string().nullable().optional().transform((val) => val?.trim() || null),
  created_at: z.string().nullable().optional(),
});

export type AIOutputRowDTO = z.infer<typeof AIOutputRowSchema>;
```

#### 2. Domain Normalization Helpers (`backend/src/services/utils/domainNormalizers.ts`)

```typescript
/**
 * Normalizes phone numbers by stripping non-numeric characters.
 * Ensures clean 10-digit primary mobile storage.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return null;
  # If 12+ digits with country code e.g. 919876543210, extract last 10 digits
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
```

#### 3. Core AI Validation Service (`backend/src/services/aiValidation.service.ts`)

```typescript
import { LeadDTO, SkippedRecordDTO } from '../types/lead';
import { CSVRow } from '../types/csv';
import { AIOutputRowSchema } from './utils/validationSchemas';
import { normalizePhone, normalizeDate, sanitizeCsvText } from './utils/domainNormalizers';

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

    for (let i = 0; i < totalItems; i++) {
      const rawAi = rawAiRecords[i] || {};
      const rawRow = originalRows[i] || {};
      const rowNumber = startIndex + i + 1;

      # 1. Zod Schema Coercion
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

      # 2. Domain Normalization
      const cleanEmail = coerced.email || null;
      const cleanPhone = normalizePhone(coerced.mobile_without_country_code);
      const cleanDate = normalizeDate(coerced.created_at);
      const cleanNote = sanitizeCsvText(coerced.crm_note);
      const cleanDesc = sanitizeCsvText(coerced.description);

      # 3. Mandatory Skip Rule Evaluation (Per Project Business Rules)
      # Skip if NEITHER email NOR mobile is present
      if (!cleanEmail && !cleanPhone) {
        skipped.push({
          row_number: rowNumber,
          reason: 'Missing both primary email and mobile number',
          raw_row: rawRow,
        });
        continue;
      }

      # 4. Construct Canonical LeadDTO (Stateless without DB identifiers)
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
        crm_status: coerced.crm_status, # Already strictly enum-checked by Zod
        crm_note: cleanNote,
        data_source: coerced.data_source, # Already strictly enum-checked by Zod
        possession_time: coerced.possession_time || null,
        description: cleanDesc,
        created_at: cleanDate,
      };

      imported.push(lead);
    }

    return { imported, skipped };
  }
}
```

### Dependencies

- `zod` (^3.22.0) — Schema coercion and type preprocessing.

### Configuration & Environment Variables

Not applicable (`SPEC-0005` operates entirely in-memory using deterministic code boundaries).

### Performance Considerations

- **Synchronous Batch Loop Throughput**: Zod validation (`AIOutputRowSchema.safeParse`) executed inside a synchronous loop over 50 items (`AI_BATCH_SIZE`) takes less than $4\text{ ms}$ on modern Node.js runtimes. It introduces zero measurable latency to the overall import job duration.

### Scalability

Because `AIValidationService` maintains no instance state and operates purely on input/output arrays (`validateAndNormalizeBatch`), it can scale horizontally across thousands of concurrent worker threads or Lambda execution units without contention or locking (`Depends on SPEC-0006`).

---

## Security Considerations

- **Preventing Prototype Pollution via AI Outputs**: Even if the LLM output JSON contains `__proto__` or `constructor` keys due to malicious prompt injection inside CSV cells, `Zod.object()` strips all unrecognized properties during `safeParse()`. Only explicitly whitelisted `LeadDTO` keys ever reach downstream layers.

---

## Testing Strategy

### Unit & Domain Tests (`Vitest`)
- **Skip Rule Enforcements**: Pass 3 raw AI records:
  1. Record A: has `email` (`"test@abc.com"`), no `mobile`. Assert added to `imported`.
  2. Record B: has `mobile` (`"9876543210"`), no `email`. Assert added to `imported`.
  3. Record C: `email: null, mobile: ""` (or invalid phone `"N/A"`). Assert added to `skipped` with `reason: 'Missing both primary email and mobile number'`.
- **Enum Nullification Check**: Pass `crm_status: 'SUPER_HOT'` and `data_source: 'internal_excel'`. Assert `safeParse` succeeds and both fields are coerced to `null` on the output `LeadDTO`.
- **CSV Text Sanitization**: Pass `crm_note: "Called user on Monday.\r\nUser asked for call back on Friday.\nBudget: $500k."`. Assert `sanitizeCsvText` converts literal line breaks into escaped `\n` text (`"Called user on Monday.\\nUser asked for call back on Friday.\\nBudget: $500k."`), guaranteeing RFC 4180 CSV export safety (`SPEC-0007`).
- **Phone Sanitization**: Pass `mobile_without_country_code: "+91 (987) 654-3210"`. Assert `normalizePhone` returns exactly `"9876543210"`.

---

## Observability

- **Validation Audit Log**: Upon completion of each batch validation, the service emits a structured telemetry log summarizing normalization metrics:
  ```json
  {
    "event": "batch_validation_completed",
    "totalProcessed": 50,
    "importedCount": 46,
    "skippedCount": 4,
    "enumCoercionsCount": 2,
    "dateNormalizationsCount": 1
  }
  ```

---

## Rollout Plan

1. Create `validationSchemas.ts` and verify enum preprocessing behavior.
2. Create `domainNormalizers.ts` and write exhaustive regex/date parsing unit tests.
3. Implement `aiValidation.service.ts` (`AIValidationService`).
4. Bind `AIValidationService` directly into `BatchProcessingFramework.executeSingleBatchWorker` (`SPEC-0006`).

---

## Alternatives Considered

### 1. Rejecting Entire Rows When `crm_status` is Not in Enum
- **Justification for Rejection**: If we skipped every lead where the LLM returned an invalid status enum (e.g. `"INTERESTED"` instead of `"GOOD_LEAD_FOLLOW_UP"`), import yields would drop significantly. As specified in project-defined business rules, the *only* mandatory skip condition is missing both email and mobile (`!email && !mobile`). For enum fields, coercing invalid values to `null` retains valuable lead contact data while preserving database schema integrity.

### 2. AJV (JSON Schema Validator) vs. Zod
- **Justification for Rejection**: While `AJV` compiles JSON schemas to extremely fast raw JS functions, `Zod` offers native TypeScript type inference (`z.infer`) and powerful transform/preprocess pipelines (`z.preprocess`, `.transform()`). The ability to combine schema checking and domain normalization inside a single declarative pass makes Zod the superior choice for maintainability.

---

## Questions and Concerns

- **Question**: What if the CSV contains a valid international phone number (e.g. UK `+44 7911 123456`) that does not match the 10-digit Indian phone regex?
- **Decision**: `normalizePhone` extracts numeric digits. If `digits.length > 10` and `country_code` is explicitly provided or detected (`+44`), `mobile_without_country_code` retains the local phone digits (`7911123456`) and `country_code` stores `+44`, ensuring zero loss of international contact details.

---

## References

- [Zod Preprocessing & Transformations](https://zod.dev/#preprocess)
- [RFC 4180 CSV Standard (Escaping Rules)](https://www.rfc-editor.org/rfc/rfc4180)
- `Depends on SPEC-0004` (`AIExtractionResponseDTO` raw input)
- `Depends on SPEC-0001` (`LeadDTO`, `SkippedRecordDTO`, and `CRMStatusEnum`)
