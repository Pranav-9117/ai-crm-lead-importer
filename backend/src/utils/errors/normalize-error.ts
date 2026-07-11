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

  if (
    error &&
    typeof error === 'object' &&
    (('type' in error && (error as { type: unknown }).type === 'entity.too.large') ||
      ('status' in error && (error as { status: unknown }).status === 413) ||
      ('statusCode' in error && (error as { statusCode: unknown }).statusCode === 413))
  ) {
    return createAppError('PAYLOAD_EXCEEDS_LIMIT', 'Payload exceeds maximum allowed limit', 413);
  }

  if (error instanceof ZodError) {
    const isPayloadTooLarge = error.issues.some(
      (issue) => issue.code === 'too_big' && issue.path[0] === 'rows'
    );
    if (isPayloadTooLarge) {
      return createAppError(
        'PAYLOAD_EXCEEDS_LIMIT',
        'Stateless import allows a maximum of 5,000 rows per request',
        413,
        { issues: error.issues }
      );
    }
    return createAppError('VALIDATION_ERROR', 'Request validation failed', 400, {
      issues: error.issues,
    });
  }

  if (error instanceof Error) {
    return createAppError('INTERNAL_SERVER_ERROR', error.message, 500);
  }

  return createAppError('INTERNAL_SERVER_ERROR', 'An unknown error occurred', 500);
}
