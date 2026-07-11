import { z } from 'zod';

export const ImportRequestSchema = z.object({
  filename: z.string().min(1, 'Filename is required').max(255, 'Filename exceeds 255 characters'),
  rows: z
    .array(z.record(z.string(), z.string()))
    .min(1, 'At least one data row must be provided')
    .max(5000, 'Stateless import allows a maximum of 5,000 rows per request'),
});

export type ImportRequestDTO = z.infer<typeof ImportRequestSchema>;
