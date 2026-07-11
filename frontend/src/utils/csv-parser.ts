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
  const isCsvMime = file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.type === 'text/plain';

  if (!isCsvExtension && !isCsvMime) {
    throw new CsvParseError('Invalid file format. Please upload a valid .csv file.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new CsvParseError('File exceeds maximum allowed size of 15 MB.');
  }
}

/**
 * Parses a client-side CSV `File` object using PapaParse without emitting network requests.
 * Returns both the extracted `CSVRow[]` array and `CsvFileMetadata`.
 */
export async function parseCsvFile(
  file: File
): Promise<{ rows: CSVRow[]; meta: CsvFileMetadata }> {
  validateCsvFile(file);

  return new Promise((resolve, reject) => {
    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          reject(new CsvParseError('The uploaded CSV file contains no data rows.'));
          return;
        }

        // If PapaParse encountered severe errors that prevented any rows or corrupted headers
        if (results.errors && results.errors.length > 0) {
          const firstError = results.errors[0];
          // If all rows failed or fatal syntax error
          if (results.data.length === 0 || firstError.type === 'Delimiter' || firstError.code === 'UndetectableDelimiter') {
            reject(
              new CsvParseError(
                `Failed to parse CSV: ${firstError.message} (Row ${firstError.row ?? 'unknown'})`
              )
            );
            return;
          }
        }

        const columns = results.meta.fields || Object.keys(results.data[0] || {});
        if (columns.length === 0) {
          reject(new CsvParseError('The uploaded CSV file contains no column headers.'));
          return;
        }

        const meta: CsvFileMetadata = {
          filename: file.name,
          sizeBytes: file.size,
          totalRows: results.data.length,
          columns,
          detectedDelimiter: results.meta.delimiter || ',',
        };

        resolve({ rows: results.data, meta });
      },
      error: (error) => {
        reject(new CsvParseError(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}
