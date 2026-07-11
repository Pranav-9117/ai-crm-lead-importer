import { z } from 'zod';
import { CRMStatusEnum, DataSourceEnum } from '../../types/enums.js';

export const AIOutputRowSchema = z.object({
  name: z.string().nullable().optional().transform((val) => val?.trim() || null),
  email: z.string().nullable().optional().transform((val) => {
    if (!val) return null;
    const clean = val.trim().toLowerCase();
    // Basic email sanity check
    return clean.includes('@') && clean.includes('.') ? clean : null;
  }),
  country_code: z.string().nullable().optional().transform((val) => val?.trim() || null),
  mobile_without_country_code: z.preprocess(
    (val) => (typeof val === 'number' ? String(val) : val),
    z.string().nullable().optional()
  ),
  company: z.string().nullable().optional().transform((val) => val?.trim() || null),
  city: z.string().nullable().optional().transform((val) => val?.trim() || null),
  state: z.string().nullable().optional().transform((val) => val?.trim() || null),
  country: z.string().nullable().optional().transform((val) => val?.trim() || null),
  lead_owner: z.string().nullable().optional().transform((val) => val?.trim() || null),
  
  // Strict enum verification: coerce anything outside enum to null
  crm_status: z.preprocess((val) => {
    if (typeof val === 'string' && Object.values(CRMStatusEnum).includes(val as CRMStatusEnum)) {
      return val;
    }
    return null;
  }, z.nativeEnum(CRMStatusEnum).nullable()),

  crm_note: z.string().nullable().optional().transform((val) => val || ''),
  
  // Strict data source enum verification
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
