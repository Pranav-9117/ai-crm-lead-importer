import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Zap, Table as TableIcon } from 'lucide-react';
import { LeadDTO } from '../../types';
import { useSortableData, useVirtualScroll } from '../../hooks';
import { PaginationControls } from './PaginationControls';

export interface ImportedLeadsTableProps {
  records: LeadDTO[];
}

export const ImportedLeadsTable: React.FC<ImportedLeadsTableProps> = ({ records }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isVirtualized, setIsVirtualized] = useState(false);

  const { items: sortedRecords, requestSort, sortConfig } = useSortableData<LeadDTO>(
    records,
    { key: 'created_at', direction: 'desc' }
  );

  const paginatedRecords = sortedRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const displayRecords = isVirtualized ? sortedRecords : paginatedRecords;

  const {
    containerRef,
    virtualItems,
    startIndex,
    endIndex,
    handleScroll,
  } = useVirtualScroll<HTMLDivElement>({
    totalItems: displayRecords.length,
    rowHeight: 60, // Estimated lead row height in px
    containerHeight: 520,
    bufferRows: 10,
  });

  const renderSortIcon = (key: keyof LeadDTO) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-secondary/50 group-hover:text-secondary" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-primary" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-primary" />
    );
  };



  const renderRowContent = (lead: LeadDTO) => {
    const phoneStr = lead.mobile_without_country_code
      ? `${lead.country_code || '+91'} ${lead.mobile_without_country_code}`
      : '-';
    const locationStr = [lead.city, lead.state].filter(Boolean).join(', ');

    return (
      <>
        <td className="py-3.5 px-4 font-semibold text-on-surface">
          {lead.name || <span className="text-secondary italic">No Name</span>}
        </td>
        <td className="py-3.5 px-4 font-mono text-xs text-on-surface/80">
          {lead.email || <span className="text-secondary italic font-sans">-</span>}
        </td>
        <td className="py-3.5 px-4 font-mono text-xs text-on-surface/80">
          {phoneStr}
        </td>
        <td className="py-3.5 px-4">
          <div className="flex flex-col">
            <span className="font-medium text-on-surface">
              {lead.company || '-'}
            </span>
            {locationStr && (
              <span className="text-xs text-secondary">{locationStr}</span>
            )}
          </div>
        </td>
        <td className="py-3.5 px-4 font-mono text-xs text-on-surface">
          {lead.crm_status || ''}
        </td>
        <td className="py-3.5 px-4 max-w-xs text-xs text-secondary truncate" title={lead.crm_note}>
          {lead.crm_note || '-'}
        </td>
        <td className="py-3.5 px-4 font-mono text-xs text-secondary">
          {lead.data_source || ''}
        </td>
      </>
    );
  };

  return (
    <div className="w-full bg-surface-container border border-outline-variant rounded-2xl shadow-xl overflow-hidden flex flex-col">
      {/* Table Top Controls / Virtualization Toggle */}
      <div className="px-6 py-3 border-b border-outline-variant bg-surface/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
            <TableIcon className="w-4 h-4 text-primary" />
            <span>Table View Mode:</span>
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${isVirtualized ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface border border-outline-variant text-secondary'}`}>
            {isVirtualized ? 'Windowed Virtual Scroll (All Rows)' : 'Standard Paginated Table'}
          </span>
        </div>

        <button
          onClick={() => setIsVirtualized(!isVirtualized)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
            isVirtualized
              ? 'bg-surface border border-outline-variant text-on-surface hover:bg-surface-dim'
              : 'bg-primary text-on-primary hover:bg-primary/90'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>
            {isVirtualized
              ? 'Switch to Paginated View'
              : `Switch to Virtual Scroll Mode (${sortedRecords.length} Rows)`}
          </span>
        </button>
      </div>

      {/* Scrollable Table Canvas */}
      <div
        ref={containerRef}
        onScroll={isVirtualized ? handleScroll : undefined}
        className={`${isVirtualized ? 'max-h-[520px] overflow-auto' : 'overflow-x-auto'} flex-1 relative scrollbar-thin`}
      >
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead className="sticky top-0 z-20 shadow-sm">
            <tr className="border-b border-outline-variant bg-surface-container-high text-secondary text-xs font-label-md uppercase tracking-wider font-bold">
              <th
                onClick={() => requestSort('name')}
                className="py-3.5 px-4 cursor-pointer group hover:text-on-surface transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Name</span>
                  {renderSortIcon('name')}
                </div>
              </th>
              <th
                onClick={() => requestSort('email')}
                className="py-3.5 px-4 cursor-pointer group hover:text-on-surface transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Email</span>
                  {renderSortIcon('email')}
                </div>
              </th>
              <th
                onClick={() => requestSort('mobile_without_country_code')}
                className="py-3.5 px-4 cursor-pointer group hover:text-on-surface transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Phone</span>
                  {renderSortIcon('mobile_without_country_code')}
                </div>
              </th>
              <th
                onClick={() => requestSort('company')}
                className="py-3.5 px-4 cursor-pointer group hover:text-on-surface transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Company & Location</span>
                  {renderSortIcon('company')}
                </div>
              </th>
              <th
                onClick={() => requestSort('crm_status')}
                className="py-3.5 px-4 cursor-pointer group hover:text-on-surface transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  {renderSortIcon('crm_status')}
                </div>
              </th>
              <th className="py-3.5 px-4">Notes / Remarks</th>
              <th
                onClick={() => requestSort('data_source')}
                className="py-3.5 px-4 cursor-pointer group hover:text-on-surface transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Data Source</span>
                  {renderSortIcon('data_source')}
                </div>
              </th>
            </tr>
          </thead>

          {isVirtualized ? (
            /* VIRTUALIZED RENDERING BODY */
            <tbody className="divide-y divide-outline-variant/60 text-sm text-on-surface">
              {startIndex > 0 && (
                <tr style={{ height: `${startIndex * 60}px` }}>
                  <td colSpan={7} className="p-0 border-0 m-0" />
                </tr>
              )}
              {virtualItems.map(({ index }) => {
                const lead = displayRecords[index];
                if (!lead) return null;

                return (
                  <tr
                    key={index}
                    className="hover:bg-surface-dim/60 transition-colors group"
                    style={{ height: '60px' }}
                  >
                    {renderRowContent(lead)}
                  </tr>
                );
              })}
              {endIndex < displayRecords.length - 1 && (
                <tr style={{ height: `${(displayRecords.length - 1 - endIndex) * 60}px` }}>
                  <td colSpan={7} className="p-0 border-0 m-0" />
                </tr>
              )}
            </tbody>
          ) : (
            /* STANDARD PAGINATED BODY */
            <tbody className="divide-y divide-outline-variant/60 text-sm text-on-surface">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-secondary font-medium">
                    No imported records match the current filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((lead, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-surface-dim/60 transition-colors group"
                  >
                    {renderRowContent(lead)}
                  </tr>
                ))
              )}
            </tbody>
          )}
        </table>
      </div>

      {!isVirtualized && (
        <PaginationControls
          currentPage={currentPage}
          totalItems={sortedRecords.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
};
