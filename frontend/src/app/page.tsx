'use client';

import React, { useState } from 'react';
import {
  Loader2,
  AlertCircle,
  History,
  FileSpreadsheet,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import {
  SideNavBar,
  TopAppBar,
  UploadOrchestrator,
  ImportResultsDashboard,
  AiProcessingProgress,
} from '../components';
import { apiClient } from '../services';
import { CSVRow, CsvFileMetadata, ImportResponseDTO } from '../types';

export default function HomePage() {
  const [navTab, setNavTab] = useState<'import' | 'history'>('import');
  const [importResult, setImportResult] = useState<ImportResponseDTO | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [activeMeta, setActiveMeta] = useState<{ filename: string; totalRows: number } | null>(null);

  // In-memory session history of completed imports
  const [importHistory, setImportHistory] = useState<
    Array<{
      id: string;
      filename: string;
      timestamp: string;
      totalRows: number;
      imported: number;
      skipped: number;
      durationMs: number;
      result: ImportResponseDTO;
    }>
  >([]);



  const handleConfirmImport = async (rows: CSVRow[], meta: CsvFileMetadata) => {
    setActiveMeta({ filename: meta.filename, totalRows: rows.length });
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
        // Record to session history log
        setImportHistory((prev) => [
          {
            id: crypto.randomUUID(),
            filename: meta.filename,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            totalRows: response.summary.totalRows,
            imported: response.summary.imported,
            skipped: response.summary.skipped,
            durationMs: response.summary.processingTimeMs,
            result: response,
          },
          ...prev,
        ]);
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
    <div className="min-h-screen bg-surface text-on-surface transition-colors duration-200">
      {/* SideNavBar Shell */}
      <SideNavBar
        activeTab={navTab}
        onTabChange={(tab) => setNavTab(tab)}
        onNewImport={() => {
          handleReset();
          setNavTab('import');
        }}
      />

      {/* TopAppBar Shell */}
      <TopAppBar
        title={navTab === 'history' ? 'Import History' : 'Import CSV'}
      />

      {/* Main Content Canvas */}
      <main className="ml-[260px] pt-16 min-h-screen">
        <div className="max-w-container-max mx-auto p-xl flex flex-col items-center justify-center min-h-[calc(100vh-64px)] relative">
          {/* Render Active Tab Content */}
          {navTab === 'history' ? (
            /* TAB: Import History */
            <div className="w-full space-y-6 animate-fadeIn max-w-5xl">
              <div className="flex items-center justify-between border-b border-outline-variant pb-4">
                <div>
                  <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
                    <History className="w-6 h-6 text-primary" />
                    <span>Session Import Logs</span>
                  </h3>
                  <p className="text-xs text-secondary mt-1">
                    Review and re-inspect imports processed during this session.
                  </p>
                </div>
                <button
                  onClick={() => {
                    handleReset();
                    setNavTab('import');
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-semibold text-sm shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
                >
                  <span>Start New Import</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {importHistory.length === 0 ? (
                <div className="p-12 rounded-2xl bg-surface-container border border-outline-variant text-center space-y-3">
                  <FileSpreadsheet className="w-12 h-12 text-secondary/40 mx-auto" />
                  <h4 className="font-semibold text-on-surface">No History Yet</h4>
                  <p className="text-secondary max-w-md font-body-md text-sm leading-relaxed">
                    You haven't completed any imports during this browser session yet. Switch to the Import CSV tab to upload your first file!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {importHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 rounded-2xl bg-surface-container border border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-primary/50 shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-on-surface text-base">
                            {item.filename}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-outline-variant text-secondary">
                            {item.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-secondary">
                          Processed in {(item.durationMs / 1000).toFixed(2)}s | Total {item.totalRows} rows
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {item.imported} Imported
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            {item.skipped} Skipped
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setImportResult(item.result);
                            setNavTab('import');
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-surface border border-outline-variant hover:bg-surface-dim text-xs font-semibold text-primary transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <span>Inspect Dashboard</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* TAB: Import CSV (Main Canvas) */
            <div className="w-full flex flex-col items-center justify-center">
              {/* Error Banner */}
              {importError && (
                <div className="w-full mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 animate-fadeIn max-w-3xl">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-rose-300">
                      Import Processing Failed
                    </h4>
                    <p className="text-xs text-rose-400/80 mt-1">{importError}</p>
                  </div>
                </div>
              )}

              {/* Processing Loading State with Real-Time Progress Indicator */}
              {isImporting ? (
                <AiProcessingProgress
                  totalRows={activeMeta?.totalRows || 0}
                  filename={activeMeta?.filename || 'crm_leads.csv'}
                />
              ) : importResult ? (
                /* Results Dashboard */
                <ImportResultsDashboard
                  response={importResult}
                  onResetImport={handleReset}
                />
              ) : (
                /* Upload Orchestrator */
                <UploadOrchestrator onConfirm={handleConfirmImport} />
              )}
            </div>
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
