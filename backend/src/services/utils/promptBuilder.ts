import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { CSVRow } from '../../types/csv.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PromptBuilder {
  private cachedSystemPrompt: string | null = null;
  private promptPath: string;

  constructor(promptPath = path.join(__dirname, '../../prompts/prompt_v1.md')) {
    this.promptPath = promptPath;
  }

  public async getSystemPrompt(): Promise<string> {
    if (!this.cachedSystemPrompt) {
      try {
        this.cachedSystemPrompt = await fs.readFile(this.promptPath, 'utf-8');
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
          // Fallback to src directory if running from dist before static files are copied
          const fallbackPath = path.resolve(process.cwd(), 'src/prompts/prompt_v1.md');
          this.cachedSystemPrompt = await fs.readFile(fallbackPath, 'utf-8');
        } else {
          throw err;
        }
      }
    }
    return this.cachedSystemPrompt;
  }

  public buildUserPrompt(rows: CSVRow[]): string {
    const currentTimestamp = new Date().toISOString();
    return JSON.stringify(
      {
        current_utc_timestamp: currentTimestamp,
        instruction: 'Transform the following CSV rows into the target GrowEasy CRM records array.',
        batch_row_count: rows.length,
        rows: rows,
      },
      null,
      2
    );
  }
}
