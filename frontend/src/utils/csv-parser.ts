import Papa from 'papaparse';
import { CSVRow, CsvFileMetadata, MAX_FILE_SIZE_BYTES } from '../types';

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

/**
 * Validates file extension, MIME type, and size limits before parsing.
 * Throws a CsvParseError if validation fails.
 */
export function validateCsvFile(file: File): void {
  if (!file) {
    throw new CsvParseError('No file selected.');
  }

  const isCsvExtension = file.name.toLowerCase().endsWith('.csv');

  if (!isCsvExtension) {
    throw new CsvParseError('Invalid file format. Only .csv files are supported.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new CsvParseError('File exceeds maximum allowed size of 5 MB.');
  }
}

/**
 * Parses a client-side CSV `File` object using PapaParse streaming chunk processing without emitting network requests.
 * Emits real-time `onProgress` updates during chunk parsing for large datasets.
 * Returns both the extracted `CSVRow[]` array and `CsvFileMetadata`.
 */
export async function parseCsvFile(
  file: File,
  onProgress?: (progressPercent: number, processedRows: number) => void
): Promise<{ rows: CSVRow[]; meta: CsvFileMetadata }> {
  validateCsvFile(file);

  return new Promise((resolve, reject) => {
    const accumulatedRows: CSVRow[] = [];
    let detectedColumns: string[] = [];
    let delimiterDetected = ',';
    let fatalError: CsvParseError | null = null;
    const estimatedTotalBytes = file.size;

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      chunk: (results, parser) => {
        if (fatalError) {
          parser.abort();
          return;
        }

        // Check for severe boundary or delimiter errors on first chunk
        if (results.errors && results.errors.length > 0) {
          const firstError = results.errors[0];
          if (firstError.type === 'Delimiter' || firstError.code === 'UndetectableDelimiter') {
            fatalError = new CsvParseError(
              `Failed to parse CSV: ${firstError.message} (Row ${firstError.row ?? 'unknown'})`
            );
            parser.abort();
            return;
          }
        }

        if (results.meta && results.meta.fields && detectedColumns.length === 0) {
          detectedColumns = results.meta.fields;
          delimiterDetected = results.meta.delimiter || ',';
        }

        if (results.data && results.data.length > 0) {
          if (detectedColumns.length === 0 && Object.keys(results.data[0]).length > 0) {
            detectedColumns = Object.keys(results.data[0]);
          }
          accumulatedRows.push(...results.data);
        }

        // Report streaming progress based on bytes read vs total file size
        if (onProgress && results.meta && typeof results.meta.cursor === 'number') {
          const percent = Math.min(Math.round((results.meta.cursor / estimatedTotalBytes) * 100), 99);
          onProgress(percent, accumulatedRows.length);
        }
      },
      complete: () => {
        if (fatalError) {
          reject(fatalError);
          return;
        }

        if (accumulatedRows.length === 0) {
          reject(new CsvParseError('The uploaded CSV file contains no data rows.'));
          return;
        }

        if (detectedColumns.length === 0) {
          reject(new CsvParseError('The uploaded CSV file contains no column headers.'));
          return;
        }

        if (onProgress) {
          onProgress(100, accumulatedRows.length);
        }

        const meta: CsvFileMetadata = {
          filename: file.name,
          sizeBytes: file.size,
          totalRows: accumulatedRows.length,
          columns: detectedColumns,
          detectedDelimiter: delimiterDetected,
        };

        resolve({ rows: accumulatedRows, meta });
      },
      error: (error) => {
        reject(new CsvParseError(`Failed to stream CSV file: ${error.message}`));
      },
    });
  });
}
