import { AppError } from './app-error.js';

/**
 * Type guard utility checking whether an unknown object implements the AppError interface.
 */
export function isAppError(error: unknown): error is AppError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const candidate = error as Record<string, unknown>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.message === 'string' &&
    typeof candidate.statusCode === 'number'
  );
}
