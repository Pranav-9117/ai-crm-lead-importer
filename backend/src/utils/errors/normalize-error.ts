import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { createAppError } from './create-app-error.js';
import { isAppError } from './is-app-error.js';

/**
 * Normalizes arbitrary caught exceptions (unknown errors, rejected Promises, validation failures)
 * into a standard `AppError` payload.
 */
export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof ZodError) {
    return createAppError('VALIDATION_ERROR', 'Request validation failed', 400, {
      issues: error.issues,
    });
  }

  if (error instanceof Error) {
    return createAppError('INTERNAL_SERVER_ERROR', error.message, 500);
  }

  return createAppError('INTERNAL_SERVER_ERROR', 'An unknown error occurred', 500);
}
