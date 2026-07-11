'use client';

import React from 'react';
import { FileSummaryCardProps } from '../../types';

/**
 * Formats bytes into human readable KB or MB string.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Maps raw delimiter characters to readable label strings.
 */
function formatDelimiter(delimiter: string): string {
  switch (delimiter) {
    case ',':
      return 'Comma (,)';
    case ';':
      return 'Semicolon (;)';
    case '\t':
      return 'Tab (\\t)';
    case '|':
      return 'Pipe (|)';
    default:
      return `Custom (${delimiter})`;
  }
}

export const FileSummaryCard: React.FC<FileSummaryCardProps> = ({ meta, onClear }) => {
  return (
    <div className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-lg shadow-sm transition-all hover:shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md pb-md border-b border-outline-variant/60">
        <div className="flex items-center gap-md">
          <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <span
              className="material-symbols-outlined text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              description
            </span>
          </div>
          <div>
            <div className="flex items-center gap-sm">
              <h4 className="font-headline-md text-body-lg font-bold text-on-surface truncate max-w-md" title={meta.filename}>
                {meta.filename}
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container text-[10px] font-label-md font-bold uppercase">
                CSV
              </span>
            </div>
            <p className="font-mono-sm text-secondary text-xs mt-0.5">
              {formatFileSize(meta.sizeBytes)} | Ready for local review
            </p>
          </div>
        </div>

        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="px-md py-sm rounded-lg border border-outline-variant hover:bg-surface-container-low text-secondary hover:text-on-surface font-label-md text-xs transition-colors flex items-center gap-xs self-start sm:self-auto"
            title="Remove and select another file"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Change File
          </button>
        )}
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-md pt-md">
        <div className="p-md rounded-lg bg-surface-container-low/60 border border-outline-variant/40 flex flex-col">
          <span className="font-label-md text-secondary text-xs flex items-center gap-xs">
            <span className="material-symbols-outlined text-[14px]">format_list_numbered</span>
            Total Rows Parsed
          </span>
          <span className="font-headline-lg text-title-lg font-bold text-on-surface mt-xs">
            {meta.totalRows.toLocaleString()}
          </span>
        </div>

        <div className="p-md rounded-lg bg-surface-container-low/60 border border-outline-variant/40 flex flex-col">
          <span className="font-label-md text-secondary text-xs flex items-center gap-xs">
            <span className="material-symbols-outlined text-[14px]">view_column</span>
            Detected Columns
          </span>
          <span className="font-headline-lg text-title-lg font-bold text-on-surface mt-xs">
            {meta.columns.length.toLocaleString()}
          </span>
        </div>

        <div className="p-md rounded-lg bg-surface-container-low/60 border border-outline-variant/40 flex flex-col col-span-2 md:col-span-1">
          <span className="font-label-md text-secondary text-xs flex items-center gap-xs">
            <span className="material-symbols-outlined text-[14px]">join_inner</span>
            Detected Delimiter
          </span>
          <span className="font-headline-lg text-title-lg font-bold text-on-surface mt-xs">
            {formatDelimiter(meta.detectedDelimiter)}
          </span>
        </div>
      </div>
    </div>
  );
};
