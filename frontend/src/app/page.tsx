'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  SideNavBar,
  TopAppBar,
  UploadOrchestrator,
  ImportResultsDashboard,
} from '../components';
import { apiClient } from '../services';
import { CSVRow, CsvFileMetadata, ImportResponseDTO } from '../types';

export default function HomePage() {
  const [backendStatus, setBackendStatus] = useState<string>('checking...');
  const [importResult, setImportResult] = useState<ImportResponseDTO | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    apiClient<{ status: string }>('/health')
      .then((data) => {
        if (isMounted && data) {
          setBackendStatus(data.status);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setBackendStatus(`offline (${err.message})`);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleConfirmImport = async (rows: CSVRow[], meta: CsvFileMetadata) => {
    setIsImporting(true);
    setImportError(null);
    try {
      const response = await apiClient<ImportResponseDTO>('/import', {
        method: 'POST',
        body: JSON.stringify({
          filename: meta.filename,
          rows,
        }),
      });

      if (response) {
        setImportResult(response);
      } else {
        throw new Error('No data returned from server');
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'An unexpected error occurred during import.';
      setImportError(errorMessage);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setImportResult(null);
    setImportError(null);
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* SideNavBar Shell */}
      <SideNavBar />

      {/* TopAppBar Shell */}
      <TopAppBar title="Import CSV" />

      {/* Main Content Canvas */}
      <main className="ml-[260px] pt-16 min-h-screen">
        <div className="max-w-container-max mx-auto p-xl flex flex-col items-center justify-center min-h-[calc(100vh-64px)] relative">
          {/* Status badge showing connection to backend API */}
          <div className="absolute top-4 right-4 flex items-center gap-xs px-sm py-xs rounded-full bg-surface-container border border-outline-variant text-[11px] font-label-md text-secondary shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>Backend API: {backendStatus}</span>
          </div>

          {/* Error Banner */}
          {importError && (
            <div className="w-full mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-rose-300">
                  Import Processing Failed
                </h4>
                <p className="text-xs text-rose-400/80 mt-1">{importError}</p>
              </div>
            </div>
          )}

          {/* Processing Loading State */}
          {isImporting ? (
            <div className="flex flex-col items-center justify-center p-12 bg-surface-container border border-outline-variant rounded-2xl shadow-xl max-w-lg w-full text-center space-y-4 animate-fadeIn">
              <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-on-surface">
                  Processing AI Extraction & Validation
                </h3>
                <p className="text-xs text-secondary mt-1 max-w-sm">
                  Orchestrating batch processing, domain normalization, and business skip rules...
                </p>
              </div>
            </div>
          ) : importResult ? (
            /* Results Dashboard (SPEC-0007) */
            <ImportResultsDashboard
              response={importResult}
              onResetImport={handleReset}
            />
          ) : (
            /* Upload Orchestrator (SPEC-0002) */
            <UploadOrchestrator onConfirm={handleConfirmImport} />
          )}
        </div>
      </main>

      {/* Floating Background Micro-interactions */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-30">
        <div className="absolute top-[20%] left-[10%] w-64 h-64 bg-primary-container rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-[30%] right-[10%] w-64 h-64 bg-surface-dim rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      </div>
    </div>
  );
}
