'use client';

import React from 'react';
import { CsvPreviewTableProps, MAX_PREVIEW_ROWS } from '../../types';

export const CsvPreviewTable: React.FC<CsvPreviewTableProps> = ({
  rows,
  columns,
  maxPreviewRows = MAX_PREVIEW_ROWS,
}) => {
  const displayRows = rows.slice(0, maxPreviewRows);

  if (!rows || rows.length === 0 || !columns || columns.length === 0) {
    return (
      <div className="w-full p-lg text-center bg-surface-container-lowest border border-outline-variant rounded-xl text-secondary">
        No CSV data to preview.
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest shadow-lg overflow-hidden flex flex-col">
      {/* Table Header / Title Bar */}
      <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary text-lg">table_chart</span>
          <h4 className="font-headline-md text-body-lg font-bold text-on-surface">
            Data Preview
          </h4>
        </div>
        <div className="font-label-md text-secondary text-xs">
          Showing <span className="font-bold text-on-surface">{displayRows.length}</span> of{' '}
          <span className="font-bold text-on-surface">{rows.length.toLocaleString()}</span> rows
        </div>
      </div>

      {/* Scrollable Sticky Table Canvas */}
      <div
        role="region"
        aria-label="CSV Data Preview Table"
        tabIndex={0}
        className="max-h-[480px] overflow-auto relative scrollbar-thin focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <table className="w-full text-left text-sm text-on-surface border-collapse">
          <thead className="bg-surface-container-high text-xs uppercase tracking-wider text-on-surface-variant font-label-md sticky top-0 z-20 shadow-sm">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 border-b border-r border-outline-variant bg-surface-container-high font-semibold sticky left-0 z-30 w-16 text-center select-none"
              >
                #
              </th>
              {columns.map((col, colIdx) => (
                <th
                  key={`${col}-${colIdx}`}
                  scope="col"
                  className="px-4 py-3 border-b border-outline-variant whitespace-nowrap font-semibold min-w-[140px]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/50 font-body-md text-xs">
            {displayRows.map((row, idx) => (
              <tr
                key={idx}
                className="hover:bg-surface-container-low/60 transition-colors group"
              >
                <td className="px-4 py-2 border-r border-outline-variant/60 bg-surface-container-lowest group-hover:bg-surface-container-low/60 text-secondary font-mono-sm sticky left-0 z-10 text-center select-none transition-colors">
                  {idx + 1}
                </td>
                {columns.map((col, colIdx) => {
                  const cellValue = row[col];
                  const hasValue = cellValue !== undefined && cellValue !== null && cellValue !== '';
                  return (
                    <td
                      key={`${idx}-${colIdx}`}
                      className="px-4 py-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[240px]"
                      title={hasValue ? String(cellValue) : ''}
                    >
                      {hasValue ? (
                        <span className="text-on-surface">{cellValue}</span>
                      ) : (
                        <span className="text-secondary/50 italic">null</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Truncation Notice Banner */}
      {rows.length > maxPreviewRows && (
        <div className="px-lg py-sm bg-surface-container-low border-t border-outline-variant text-xs font-label-md text-secondary text-center">
          Showing preview of first <strong className="text-on-surface">{maxPreviewRows}</strong> rows out of{' '}
          <strong className="text-on-surface">{rows.length.toLocaleString()}</strong> total rows. All rows will be processed upon confirmation.
        </div>
      )}
    </div>
  );
};
