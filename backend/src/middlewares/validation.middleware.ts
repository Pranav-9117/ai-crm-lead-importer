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
        req.query = await schemas.query.parseAsync(req.query) as Record<string, any>;
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params) as Record<string, any>;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          createAppError('VALIDATION_ERROR', 'Request validation failed', 400, {
            issues: error.issues,
          })
        );
      } else {
        next(error);
      }
    }
  };
}
