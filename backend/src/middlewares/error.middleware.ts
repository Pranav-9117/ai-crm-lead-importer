import { Request, Response, NextFunction } from 'express';
import { normalizeError } from '../utils/errors/index.js';
import { ApiResponse } from '../types/index.js';
import { config } from '../utils/config.js';

/**
 * Global Express Error Middleware.
 * Consumes functional `AppError` objects or normalizes arbitrary exceptions
 * to return standardized `ApiResponse<void>` error payloads.
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const appError = normalizeError(err);

  const responsePayload: ApiResponse<void> = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details && { details: appError.details }),
      ...(config.NODE_ENV !== 'production' && err instanceof Error && err.stack && {
        stack: err.stack,
      }),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  res.status(appError.statusCode).json(responsePayload);
}
