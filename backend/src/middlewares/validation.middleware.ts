import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createAppError } from '../utils/errors/index.js';

export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Request Validation Middleware factory.
 * Intercepts incoming route requests to enforce server-side Zod validation rules before invoking controllers.
 */
export function validateRequest(schemas: ValidationSchemas) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as unknown as Request['query'];
      }
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as unknown as Request['params'];
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const isPayloadTooLarge = error.issues.some(
          (issue) => issue.code === 'too_big' && issue.path[0] === 'rows'
        );
        if (isPayloadTooLarge) {
          next(
            createAppError(
              'PAYLOAD_EXCEEDS_LIMIT',
              'Stateless import allows a maximum of 5,000 rows per request',
              413,
              { issues: error.issues }
            )
          );
          return;
        }

        const isImportEndpoint = req.originalUrl.includes('/import');
        const code = isImportEndpoint ? 'INVALID_PAYLOAD' : 'VALIDATION_ERROR';
        const message = isImportEndpoint
          ? 'Invalid import payload structure'
          : 'Request validation failed';

        next(
          createAppError(code, message, 400, {
            issues: error.issues,
          })
        );
      } else {
        next(error);
      }
    }
  };
}
