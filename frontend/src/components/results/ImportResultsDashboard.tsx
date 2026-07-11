import React, { useState, useMemo } from 'react';
import { Download, Search, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ImportResponseDTO } from '../../types';
import { SummaryCards } from './SummaryCards';
import { ImportedLeadsTable } from './ImportedLeadsTable';
import { SkippedRecordsTable } from './SkippedRecordsTable';
import { downloadProcessedCsv, downloadSkippedCsv } from '../../utils';
import { useDebounce } from '../../hooks';

export interface ImportResultsDashboardProps {
  response: ImportResponseDTO;
  onResetImport: () => void;
}

export const ImportResultsDashboard: React.FC<ImportResultsDashboardProps> = ({
  response,
  onResetImport,
}) => {
  const [activeTab, setActiveTab] = useState<'imported' | 'skipped'>('imported');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 200);

  // Memoized Search Filtering for Imported Leads
  const filteredImported = useMemo(() => {
    if (!debouncedSearch) return response.importedRecords;
    const query = debouncedSearch.toLowerCase();
    return response.importedRecords.filter((lead) =>
      [
        lead.name,
        lead.email,
        lead.mobile_without_country_code,
        lead.company,
        lead.crm_note,
        lead.crm_status,
      ]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(query))
    );
  }, [response.importedRecords, debouncedSearch]);

  // Memoized Search Filtering for Skipped Records
  const filteredSkipped = useMemo(() => {
    if (!debouncedSearch) return response.skippedRecords;
    const query = debouncedSearch.toLowerCase();
    return response.skippedRecords.filter(
      (skip) =>
        skip.reason.toLowerCase().includes(query) ||
        JSON.stringify(skip.raw_row).toLowerCase().includes(query)
    );
  }, [response.skippedRecords, debouncedSearch]);

  return (
    <div className="w-full space-y-6 animate-fadeIn">
      {/* Summary KPI Metrics Container */}
      <SummaryCards
        totalReceived={response.summary.totalRows}
        totalImported={response.summary.imported}
        totalSkipped={response.summary.skipped}
        processingTimeMs={response.summary.processingTimeMs}
      />

      {/* Action Toolbar & Tab Switcher */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-surface-container p-4 rounded-2xl border border-outline-variant shadow-md">
        <div className="flex rounded-xl bg-surface p-1 border border-outline-variant w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('imported')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-1 sm:flex-initial ${
              activeTab === 'imported'
                ? 'bg-primary text-on-primary shadow-md'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Successfully Imported ({response.summary.imported})</span>
          </button>
          <button
            onClick={() => setActiveTab('skipped')}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex-1 sm:flex-initial ${
              activeTab === 'skipped'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Skipped Records ({response.summary.skipped})</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
            <input
              type="text"
              placeholder="Search records or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-surface border border-outline-variant rounded-xl text-sm text-on-surface placeholder:text-secondary/70 focus:outline-none focus:ring-2 focus:ring-primary w-full transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {activeTab === 'imported' ? (
              <button
                onClick={() =>
                  downloadProcessedCsv(filteredImported, 'processed_crm_leads.csv')
                }
                disabled={filteredImported.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center justify-center gap-2 whitespace-nowrap flex-1 sm:flex-initial"
              >
                <Download className="w-4 h-4" />
                <span>Download Processed CSV</span>
              </button>
            ) : (
              <button
                onClick={() =>
                  downloadSkippedCsv(filteredSkipped, 'skipped_crm_records.csv')
                }
                disabled={filteredSkipped.length === 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center justify-center gap-2 whitespace-nowrap flex-1 sm:flex-initial"
              >
                <Download className="w-4 h-4" />
                <span>Download Skipped CSV</span>
              </button>
            )}

            <button
              onClick={onResetImport}
              className="px-4 py-2 bg-surface hover:bg-surface-dim text-on-surface text-sm font-semibold rounded-xl border border-outline-variant transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>New Import</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Views */}
      <div className="transition-all">
        {activeTab === 'imported' ? (
          <ImportedLeadsTable records={filteredImported} />
        ) : (
          <SkippedRecordsTable records={filteredSkipped} />
        )}
      </div>
    </div>
  );
};
