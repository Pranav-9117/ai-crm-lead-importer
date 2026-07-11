'use client';

import React, { useState } from 'react';
import { CsvPreviewTableProps, MAX_PREVIEW_ROWS } from '../../types';
import { useVirtualScroll } from '../../hooks';
import { Zap, Table as TableIcon } from 'lucide-react';

export const CsvPreviewTable: React.FC<CsvPreviewTableProps> = ({
  rows,
  columns,
  maxPreviewRows = MAX_PREVIEW_ROWS,
}) => {
  const [isVirtualized, setIsVirtualized] = useState<boolean>(rows && rows.length > maxPreviewRows);

  const displayRows = isVirtualized ? rows : rows.slice(0, maxPreviewRows);

  const {
    containerRef,
    virtualItems,
    startIndex,
    endIndex,
    handleScroll,
  } = useVirtualScroll<HTMLDivElement>({
    totalItems: displayRows.length,
    rowHeight: 41, // Average row height in px
    containerHeight: 480,
    bufferRows: 12,
  });

  if (!rows || rows.length === 0 || !columns || columns.length === 0) {
    return (
      <div className="w-full p-lg text-center bg-surface-container-lowest border border-outline-variant rounded-xl text-secondary">
        No CSV data to preview.
      </div>
    );
  }

  return (
    <div className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest shadow-lg overflow-hidden flex flex-col animate-fadeIn">
      {/* Table Header / Title Bar */}
      <div className="px-lg py-md border-b border-outline-variant bg-surface-container-low flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2.5">
          <TableIcon className="w-5 h-5 text-primary shrink-0" />
          <div>
            <h4 className="font-headline-md text-body-lg font-bold text-on-surface flex items-center gap-2">
              <span>Data Preview Dashboard</span>
              {isVirtualized && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1">
                  <Zap className="w-3 h-3 text-primary animate-pulse" />
                  <span>Virtualized DOM</span>
                </span>
              )}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {rows.length > maxPreviewRows && (
            <button
              onClick={() => setIsVirtualized(!isVirtualized)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                isVirtualized
                  ? 'bg-primary text-on-primary hover:bg-primary/90'
                  : 'bg-surface border border-outline-variant text-secondary hover:text-on-surface hover:bg-surface-dim'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>
                {isVirtualized
                  ? `Virtual Scroll Mode (All ${rows.length.toLocaleString()} Rows)`
                  : `Switch to Virtualized Table (${rows.length.toLocaleString()} Rows)`}
              </span>
            </button>
          )}

          <div className="font-label-md text-secondary text-xs px-2 py-1 rounded bg-surface border border-outline-variant font-mono">
            Showing <span className="font-bold text-on-surface">{displayRows.length.toLocaleString()}</span> of{' '}
            <span className="font-bold text-on-surface">{rows.length.toLocaleString()}</span> rows
          </div>
        </div>
      </div>

      {/* Scrollable Sticky/Virtualized Table Canvas */}
      <div
        ref={containerRef}
        onScroll={isVirtualized ? handleScroll : undefined}
        role="region"
        aria-label="CSV Data Preview Table"
        tabIndex={0}
        className="max-h-[480px] overflow-auto relative scrollbar-thin focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <table className="w-full text-left text-sm text-on-surface border-collapse">
          <thead className="bg-surface-container-high text-xs uppercase tracking-wider text-secondary font-label-md sticky top-0 z-20 shadow-sm">
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

          {isVirtualized ? (
            /* VIRTUALIZED RENDERING BODY */
            <tbody className="divide-y divide-outline-variant/50 font-body-md text-xs">
              {startIndex > 0 && (
                <tr style={{ height: `${startIndex * 41}px` }}>
                  <td colSpan={columns.length + 1} className="p-0 border-0 m-0" />
                </tr>
              )}
              {virtualItems.map(({ index }) => {
                const row = displayRows[index];
                if (!row) return null;

                return (
                  <tr
                    key={index}
                    className="hover:bg-surface-container-low/60 transition-colors group"
                    style={{ height: '41px' }}
                  >
                    <td className="px-4 py-2 border-r border-outline-variant/60 bg-surface-container-lowest group-hover:bg-surface-container-low/60 text-secondary font-mono sticky left-0 z-10 text-center select-none transition-colors">
                      {index + 1}
                    </td>
                    {columns.map((col, colIdx) => {
                      const cellValue = row[col];
                      const hasValue = cellValue !== undefined && cellValue !== null && cellValue !== '';
                      return (
                        <td
                          key={`${index}-${colIdx}`}
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
                );
              })}
              {endIndex < displayRows.length - 1 && (
                <tr style={{ height: `${(displayRows.length - 1 - endIndex) * 41}px` }}>
                  <td colSpan={columns.length + 1} className="p-0 border-0 m-0" />
                </tr>
              )}
            </tbody>
          ) : (
            /* STANDARD RENDERING BODY */
            <tbody className="divide-y divide-outline-variant/50 font-body-md text-xs">
              {displayRows.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-surface-container-low/60 transition-colors group"
                >
                  <td className="px-4 py-2 border-r border-outline-variant/60 bg-surface-container-lowest group-hover:bg-surface-container-low/60 text-secondary font-mono sticky left-0 z-10 text-center select-none transition-colors">
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
          )}
        </table>
      </div>

      {/* Truncation / Virtualization Footer Notice */}
      <div className="px-lg py-sm bg-surface-container-low border-t border-outline-variant text-xs font-label-md text-secondary text-center flex items-center justify-center gap-2">
        {isVirtualized ? (
          <>
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>
              Rendering <strong className="text-on-surface">all {rows.length.toLocaleString()} rows</strong> using Windowed DOM Virtualization for maximum browser performance.
            </span>
          </>
        ) : rows.length > maxPreviewRows ? (
          <span>
            Showing preview of first <strong className="text-on-surface">{maxPreviewRows}</strong> rows out of{' '}
            <strong className="text-on-surface">{rows.length.toLocaleString()}</strong> total rows. Click <strong>Switch to Virtualized Table</strong> to inspect all rows instantly.
          </span>
        ) : (
          <span>
            All <strong className="text-on-surface">{rows.length}</strong> rows loaded and ready for AI ingestion.
          </span>
        )}
      </div>
    </div>
  );
};
