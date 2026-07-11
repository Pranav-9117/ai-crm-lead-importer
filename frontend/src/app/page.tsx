'use client';

import React, { useEffect, useState } from 'react';
import { SideNavBar, TopAppBar, UploadOrchestrator } from '../components';
import { apiClient } from '../services';
import { CSVRow, CsvFileMetadata } from '../types';

export default function HomePage() {
  const [backendStatus, setBackendStatus] = useState<string>('checking...');

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
    console.log('Confirmed import for file:', meta.filename, 'Rows:', rows.length);
    // Downstream SPEC-0003 will invoke POST /api/import with this payload
    alert(
      `Ready for SPEC-0003 API Import:\n\nFile: ${meta.filename}\nRows: ${meta.totalRows.toLocaleString()}\nColumns: ${meta.columns.join(
        ', '
      )}\n\nZero server requests made prior to this confirmation.`
    );
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
          
          {/* Status badge showing connection to backend API (SPEC-0001 Foundation verification) */}
          <div className="absolute top-4 right-4 flex items-center gap-xs px-sm py-xs rounded-full bg-surface-container border border-outline-variant text-[11px] font-label-md text-secondary">
            <span
              className={`w-2 h-2 rounded-full ${
                backendStatus === 'ok' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>Backend API: {backendStatus}</span>
          </div>

          <UploadOrchestrator onConfirm={handleConfirmImport} />
        </div>
      </main>

      {/* Floating Background Micro-interactions (Canvas) */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-30">
        <div className="absolute top-[20%] left-[10%] w-64 h-64 bg-primary-container rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-[30%] right-[10%] w-64 h-64 bg-surface-dim rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      </div>
    </div>
  );
}
