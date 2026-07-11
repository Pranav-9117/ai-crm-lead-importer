import express, { Application } from 'express';
import cors from 'cors';
import { apiRouter } from './routes/index.js';
import { errorMiddleware } from './middlewares/index.js';
import { createAppError } from './utils/errors/index.js';

export function createApp(): Application {
  const app = express();

  // Cross-Origin Resource Sharing
  app.use(cors());

  // JSON Body Parser
  app.use(express.json({ limit: '100mb' }));

  // API Routes
  app.use('/api', apiRouter);

  // 404 Handler for unmatched API routes
  app.use('*', (req, _res, next) => {
    next(createAppError('NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`, 404));
  });

  // Global Error Handling Middleware
  app.use(errorMiddleware);

  return app;
}
