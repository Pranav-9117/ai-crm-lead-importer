'use client';

import React, { useState, useCallback } from 'react';
import { UploadOrchestratorProps, UploadState, CSVRow, CsvFileMetadata } from '../../types';
import { CsvDropzone } from './CsvDropzone';
import { CsvPreviewTable } from './CsvPreviewTable';
import { FileSummaryCard } from './FileSummaryCard';

const INITIAL_STATE: UploadState = {
  status: 'idle',
  rows: null,
  meta: null,
  errorMessage: null,
};

export const UploadOrchestrator: React.FC<UploadOrchestratorProps> = ({ onConfirm }) => {
  const [state, setState] = useState<UploadState>(INITIAL_STATE);

  const handleFileParsed = useCallback((rows: CSVRow[], meta: CsvFileMetadata) => {
    setState({
      status: 'preview_ready',
      rows,
      meta,
      errorMessage: null,
    });
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    setState((prev) => ({
      ...prev,
      status: 'error',
      errorMessage,
    }));
  }, []);

  const handleProcessingChange = useCallback((isProcessing: boolean) => {
    setState((prev) => {
      // If going into processing mode and currently idle or error
      if (isProcessing) {
        return { ...prev, status: 'parsing', errorMessage: null };
      }
      // If parsing finished without triggering handleFileParsed or handleError, keep current state
      return prev;
    });
  }, []);

  const handleCancel = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!state.rows || !state.meta) return;

    setState((prev) => ({ ...prev, status: 'submitting' }));
    try {
      if (onConfirm) {
        await onConfirm(state.rows, state.meta);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit import.';
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: msg,
      }));
    }
  }, [state.rows, state.meta, onConfirm]);

  return (
    <div className="w-full flex flex-col items-center gap-xl">
      {/* Error Banner */}
      {state.errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="w-full max-w-4xl bg-error-container/20 border border-error/50 rounded-xl p-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-md animate-fadeIn shadow-sm"
        >
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center text-error shrink-0">
              <span className="material-symbols-outlined">error</span>
            </div>
            <div>
              <h5 className="font-headline-md text-body-lg font-bold text-on-surface">
                CSV Parsing Issue
              </h5>
              <p className="font-body-md text-sm text-secondary mt-0.5">
                {state.errorMessage}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setState(INITIAL_STATE)}
            className="px-md py-sm rounded-lg bg-surface-container-low hover:bg-surface-container border border-outline-variant text-on-surface font-label-md text-xs transition-colors shrink-0 flex items-center gap-xs self-end sm:self-auto"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Try Again
          </button>
        </div>
      )}

      {/* View States */}
      {(state.status === 'idle' || state.status === 'parsing' || state.status === 'error') && (
        <CsvDropzone
          onFileParsed={handleFileParsed}
          onError={handleError}
          onProcessingChange={handleProcessingChange}
          isProcessing={state.status === 'parsing'}
        />
      )}

      {(state.status === 'preview_ready' || state.status === 'submitting') &&
        state.rows &&
        state.meta && (
          <div className="w-full max-w-6xl space-y-lg animate-fadeIn">
            {/* Summary Card */}
            <FileSummaryCard meta={state.meta} onClear={handleCancel} />

            {/* Preview Table */}
            <CsvPreviewTable rows={state.rows} columns={state.meta.columns} />

            {/* Action Bar */}
            <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-md flex flex-col sm:flex-row items-center justify-between gap-md">
              <div className="flex items-center gap-sm text-secondary text-xs font-body-md">
                <span className="material-symbols-outlined text-primary text-base">info</span>
                <span>
                  No data has been uploaded to the server yet. Click confirm when ready to proceed.
                </span>
              </div>

              <div className="flex items-center gap-md w-full sm:w-auto justify-end">
                <button
                  type="button"
                  disabled={state.status === 'submitting'}
                  onClick={handleCancel}
                  className="px-lg py-sm rounded-lg border border-outline-variant hover:bg-surface-container-low text-on-surface font-label-md transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  Cancel / Change File
                </button>
                <button
                  type="button"
                  disabled={state.status === 'submitting'}
                  onClick={handleConfirm}
                  className="px-xl py-sm rounded-lg bg-primary text-on-primary font-label-md font-bold transition-all hover:opacity-90 shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-sm"
                >
                  {state.status === 'submitting' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span>Confirm Import</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
