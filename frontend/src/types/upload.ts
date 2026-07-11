import { CSVRow } from './csv';

/**
 * Maximum allowed CSV file size in bytes (15 MB).
 */
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

/**
 * Maximum number of sample rows rendered in the client-side preview table
 * to prevent DOM layout reflow bottlenecks on large files.
 */
export const MAX_PREVIEW_ROWS = 100;

/**
 * Metadata extracted during client-side CSV parsing.
 */
export interface CsvFileMetadata {
  filename: string;
  sizeBytes: number;
  totalRows: number;
  columns: string[];
  detectedDelimiter: string;
}

/**
 * State enum/types representing the current status of the upload orchestrator.
 */
export type UploadStatus = 'idle' | 'parsing' | 'preview_ready' | 'submitting' | 'error';

export interface UploadState {
  status: UploadStatus;
  rows: CSVRow[] | null;
  meta: CsvFileMetadata | null;
  errorMessage: string | null;
}

/**
 * Props for CsvDropzone component.
 */
export interface CsvDropzoneProps {
  onFileParsed: (rows: CSVRow[], meta: CsvFileMetadata) => void;
  onError: (errorMessage: string) => void;
  onProcessingChange?: (isProcessing: boolean) => void;
  isProcessing?: boolean;
}

/**
 * Props for CsvPreviewTable component.
 */
export interface CsvPreviewTableProps {
  rows: CSVRow[];
  columns: string[];
  maxPreviewRows?: number;
}

/**
 * Props for FileSummaryCard component.
 */
export interface FileSummaryCardProps {
  meta: CsvFileMetadata;
  onClear?: () => void;
}

/**
 * Props for UploadOrchestrator component.
 */
export interface UploadOrchestratorProps {
  onConfirm?: (rows: CSVRow[], meta: CsvFileMetadata) => Promise<void> | void;
}
