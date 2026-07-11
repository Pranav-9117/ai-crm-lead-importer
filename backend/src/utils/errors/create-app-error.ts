import { AppError } from './app-error.js';

/**
 * Constructs a structured `AppError` plain object with explicit code, message, statusCode, and optional details.
 */
export function createAppError(
  code: string,
  message: string,
  statusCode = 500,
  details?: Record<string, unknown>
): AppError {
  return {
    code,
    message,
    statusCode,
    ...(details && { details }),
  };
}
