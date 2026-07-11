import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AIExtractionEngine } from '../services/aiExtraction.service.js';
import { PromptBuilder } from '../services/utils/promptBuilder.js';
import { TokenAccountingService } from '../services/utils/tokenAccounting.js';
import { CSVRow } from '../types/csv.js';

const server = setupServer();

describe('AI Extraction Engine', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => server.close());
  afterEach(() => {
    server.resetHandlers();
    vi.restoreAllMocks();
  });

  describe('1. Prompt Verification & PromptBuilder', () => {
    it('should load prompt_v1.md and verify all enum values and data source strings are present verbatim', async () => {
      const promptBuilder = new PromptBuilder();
      const systemPrompt = await promptBuilder.getSystemPrompt();

      // Check crm_status enums
      expect(systemPrompt).toContain('"GOOD_LEAD_FOLLOW_UP"');
      expect(systemPrompt).toContain('"DID_NOT_CONNECT"');
      expect(systemPrompt).toContain('"BAD_LEAD"');
      expect(systemPrompt).toContain('"SALE_DONE"');

      // Check data_source enums
      expect(systemPrompt).toContain('"leads_on_demand"');
      expect(systemPrompt).toContain('"meridian_tower"');
      expect(systemPrompt).toContain('"eden_park"');
      expect(systemPrompt).toContain('"varah_swamy"');
      expect(systemPrompt).toContain('"sarjapur_plots"');

      // Check critical rules
      expect(systemPrompt).toContain('multi-line line breaks');
      expect(systemPrompt).toContain('NEWLINE ESCAPING');
      expect(systemPrompt).toContain('TARGET OUTPUT SCHEMA PER RECORD');
    });

    it('should correctly format arbitrary CSV rows into JSON-safe user prompt', () => {
      const promptBuilder = new PromptBuilder();
      const sampleRows: CSVRow[] = [
        { First_Name: 'John Doe', Phone: '9876543210', Notes: 'Call in morning\nOr afternoon' },
      ];

      const userPromptStr = promptBuilder.buildUserPrompt(sampleRows);
      const parsedUserPrompt = JSON.parse(userPromptStr);

      expect(parsedUserPrompt.batch_row_count).toBe(1);
      expect(parsedUserPrompt.rows).toEqual(sampleRows);
      expect(parsedUserPrompt.instruction).toBeDefined();
      expect(parsedUserPrompt.current_utc_timestamp).toBeDefined();
    });
  });

  describe('2. Token Accounting Service', () => {
    it('should calculate accurate cost metrics using GPT-4.1 Mini pricing ($0.15/1M prompt, $0.60/1M completion)', () => {
      const accounting = new TokenAccountingService();
      const result = accounting.calculateMetrics(1000, 500);

      // (1000 / 1,000,000) * 0.15 + (500 / 1,000,000) * 0.60 = 0.00015 + 0.00030 = 0.00045
      expect(result.costUsd).toBe(0.00045);
    });
  });

  describe('3. AIExtractionEngine Mock Extraction & Error Handling', () => {
    it('should execute extraction against OpenAI and return transformed records and metrics', async () => {
      const sampleRows: CSVRow[] = [
        { Name: 'Lead 1', Cell: '1111111111' },
        { Name: 'Lead 2', Cell: '2222222222' },
      ];

      const mockTransformedRecords = [
        { name: 'Lead 1', mobile_without_country_code: '1111111111', crm_status: 'GOOD_LEAD_FOLLOW_UP', crm_note: '', created_at: '2026-07-11T10:00:00Z' },
        { name: 'Lead 2', mobile_without_country_code: '2222222222', crm_status: null, crm_note: '', created_at: '2026-07-11T10:00:00Z' },
      ];

      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'chatcmpl-mock123',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4.1-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({ records: mockTransformedRecords }),
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 1000,
              completion_tokens: 500,
              total_tokens: 1500,
            },
          });
        })
      );

      const engine = new AIExtractionEngine();
      const result = await engine.extractBatch('job-123', 1, sampleRows);

      expect(result.rawRecords).toHaveLength(2);
      expect(result.rawRecords).toEqual(mockTransformedRecords);
      expect(result.tokensUsed).toBe(1500);
      expect(result.estimatedCostUsd).toBe(0.00045);
    });

    it('should throw AI_MALFORMED_JSON with HTTP 502 when OpenAI returns malformed JSON', async () => {
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'chatcmpl-mock123',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4.1-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '```json\n{ "records": [{ "name": "Broken ... ',
                },
                finish_reason: 'stop',
              },
            ],
          });
        })
      );

      const engine = new AIExtractionEngine();
      await expect(engine.extractBatch('job-123', 1, [{ Name: 'Test' }])).rejects.toMatchObject({
        code: 'AI_MALFORMED_JSON',
        statusCode: 502,
      });
    });

    it('should throw AI_MISSING_RECORDS_ARRAY with HTTP 502 when records root property is missing', async () => {
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'chatcmpl-mock123',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4.1-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({ items: [] }),
                },
                finish_reason: 'stop',
              },
            ],
          });
        })
      );

      const engine = new AIExtractionEngine();
      await expect(engine.extractBatch('job-123', 1, [{ Name: 'Test' }])).rejects.toMatchObject({
        code: 'AI_MISSING_RECORDS_ARRAY',
        statusCode: 502,
      });
    });

    it('should throw AI_EMPTY_RESPONSE with HTTP 502 when OpenAI choice/content is empty', async () => {
      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'chatcmpl-mock123',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4.1-mini',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: '' },
                finish_reason: 'stop',
              },
            ],
          });
        })
      );

      const engine = new AIExtractionEngine();
      await expect(engine.extractBatch('job-123', 1, [{ Name: 'Test' }])).rejects.toMatchObject({
        code: 'AI_EMPTY_RESPONSE',
        statusCode: 502,
      });
    });

    it('should log warning when row count does not match extracted records count', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      server.use(
        http.post('https://api.openai.com/v1/chat/completions', () => {
          return HttpResponse.json({
            id: 'chatcmpl-mock123',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4.1-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({ records: [{ name: 'Only One Record' }] }),
                },
                finish_reason: 'stop',
              },
            ],
          });
        })
      );

      const engine = new AIExtractionEngine();
      await engine.extractBatch('job-123', 2, [{ Name: 'Row 1' }, { Name: 'Row 2' }]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ai_row_count_mismatch] Expected 2 records, got 1 records for job job-123, batch 2')
      );
    });
  });
});
