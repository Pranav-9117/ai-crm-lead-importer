import { Router, Request, Response } from 'express';
import { ApiResponse } from '../types/index.js';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  const payload: ApiResponse<{ status: string }> = {
    success: true,
    data: {
      status: 'ok',
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  res.status(200).json(payload);
});
