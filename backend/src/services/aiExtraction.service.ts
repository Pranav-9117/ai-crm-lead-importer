import { OpenAI } from 'openai';
import { CSVRow } from '../types/csv.js';
import { createAppError } from '../utils/errors/create-app-error.js';
import { PromptBuilder } from './utils/promptBuilder.js';
import { TokenAccountingService } from './utils/tokenAccounting.js';
import { config } from '../utils/config.js';

export interface AIExtractionResponseDTO {
  rawRecords: Record<string, unknown>[];
  tokensUsed: number;
  estimatedCostUsd: number;
}

export class AIExtractionEngine {
  private openai: OpenAI;
  private promptBuilder: PromptBuilder;
  private accounting: TokenAccountingService;
  private model: string;

  constructor(
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || config.OPENAI_API_KEY || 'sk-placeholder_for_local_development_only' }),
    promptBuilder = new PromptBuilder(),
    accounting = new TokenAccountingService()
  ) {
    this.openai = openai;
    this.promptBuilder = promptBuilder;
    this.accounting = accounting;
    this.model = process.env.OPENAI_MODEL || config.OPENAI_MODEL || 'gpt-4.1-mini';
  }

  /**
   * Executes a single extraction request against OpenAI.
   * Note: Retries and exponential backoff are handled entirely by SPEC-0006.
   */
  public async extractBatch(
    jobId: string,
    batchNumber: number,
    rows: CSVRow[]
  ): Promise<AIExtractionResponseDTO> {
    const systemPrompt = await this.promptBuilder.getSystemPrompt();
    const userPrompt = this.promptBuilder.buildUserPrompt(rows);

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message?.content) {
      throw createAppError('AI_EMPTY_RESPONSE', 'OpenAI returned empty completion payload', 502);
    }

    let parsedContent: { records?: Record<string, unknown>[] };
    try {
      parsedContent = JSON.parse(choice.message.content);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw createAppError('AI_MALFORMED_JSON', `Failed to parse JSON from OpenAI completion: ${msg}`, 502);
    }

    if (!parsedContent.records || !Array.isArray(parsedContent.records)) {
      throw createAppError('AI_MISSING_RECORDS_ARRAY', 'OpenAI JSON payload missing root "records" array', 502);
    }

    if (parsedContent.records.length !== rows.length) {
      console.warn(`[ai_row_count_mismatch] Expected ${rows.length} records, got ${parsedContent.records.length} records for job ${jobId}, batch ${batchNumber}`);
    }

    const usage = completion.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const costMetrics = this.accounting.calculateMetrics(usage.prompt_tokens, usage.completion_tokens);

    return {
      rawRecords: parsedContent.records,
      tokensUsed: usage.total_tokens,
      estimatedCostUsd: costMetrics.costUsd,
    };
  }
}

export { AIExtractionEngine as AIClient };
