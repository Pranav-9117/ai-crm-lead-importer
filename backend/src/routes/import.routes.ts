import { Router } from 'express';
import { ImportController } from '../controllers/import.controller.js';
import { validateRequest } from '../middlewares/index.js';
import { ImportRequestSchema } from '../validators/import.validator.js';

export const importRouter = Router();
const importController = new ImportController();

importRouter.post(
  '/',
  validateRequest({ body: ImportRequestSchema }),
  importController.handleImport
);
