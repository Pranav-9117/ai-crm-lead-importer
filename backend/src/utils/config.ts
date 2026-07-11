import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().default('gpt-4.1-mini'),
  AI_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  MAX_BATCH_RETRIES: z.coerce.number().int().nonnegative().default(3),
  BATCH_CONCURRENCY_LIMIT: z.coerce.number().int().positive().default(3),
  PORT: z.coerce.number().int().positive().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type AppConfig = z.infer<typeof configSchema>;

function loadConfig(): AppConfig {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment configuration:', result.error.format());
    // In strict environments or production, throw or exit
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
  return configSchema.parse(process.env);
}

export const config = loadConfig();
