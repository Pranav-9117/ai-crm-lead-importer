import { Router } from 'express';
import { healthRouter } from './health.route.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);

// Future routes (e.g., /import - SPEC-0003) will be mounted here
