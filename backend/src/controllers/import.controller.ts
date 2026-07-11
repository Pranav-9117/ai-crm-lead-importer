import { Request, Response, NextFunction } from 'express';
import { ImportRequestDTO } from '../validators/import.validator.js';
import { ImportService } from '../services/import.service.js';
import { ApiResponse } from '../types/index.js';

export class ImportController {
  private importService: ImportService;

  constructor(importService = new ImportService()) {
    this.importService = importService;
  }

  public handleImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filename, rows } = req.body as ImportRequestDTO;

      console.info(`Import request received for file: ${filename} (${rows.length} rows)`);

      const importResponse = await this.importService.executeImport(rows);

      console.info(`Import request completed for file: ${filename}`);

      const responseBody: ApiResponse<typeof importResponse> = {
        success: true,
        data: importResponse,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };

      res.status(200).json(responseBody);
    } catch (error) {
      console.error('Error during import execution:', error);
      next(error);
    }
  };
}
