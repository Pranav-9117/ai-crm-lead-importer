import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { importRouter } from './import.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/import', importRouter);
