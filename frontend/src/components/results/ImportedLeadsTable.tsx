import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LeadDTO, CRMStatusEnum } from '../../types';
import { useSortableData } from '../../hooks';
import { PaginationControls } from './PaginationControls';

export interface ImportedLeadsTableProps {
  records: LeadDTO[];
}

export const ImportedLeadsTable: React.FC<ImportedLeadsTableProps> = ({ records }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { items: sortedRecords, requestSort, sortConfig } = useSortableData<LeadDTO>(
    records,
    { key: 'created_at', direction: 'desc' }
  );

  const paginatedRecords = sortedRecords.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

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

  const renderStatusBadge = (status: CRMStatusEnum | null) => {
    if (!status) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface border border-outline-variant text-secondary">
          Unassigned
        </span>
      );
    }
    const statusMap: Record<CRMStatusEnum, { bg: string; text: string; label: string }> = {
      [CRMStatusEnum.GOOD_LEAD_FOLLOW_UP]: {
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        text: 'text-emerald-400',
        label: 'Good Lead / Follow Up',
      },
      [CRMStatusEnum.SALE_DONE]: {
        bg: 'bg-blue-500/10 border-blue-500/20',
        text: 'text-blue-400',
        label: 'Sale Done',
      },
      [CRMStatusEnum.DID_NOT_CONNECT]: {
        bg: 'bg-amber-500/10 border-amber-500/20',
        text: 'text-amber-400',
        label: 'Did Not Connect',
      },
      [CRMStatusEnum.BAD_LEAD]: {
        bg: 'bg-rose-500/10 border-rose-500/20',
        text: 'text-rose-400',
        label: 'Bad Lead',
      },
    };

    const config = statusMap[status] || {
      bg: 'bg-surface border-outline-variant',
      text: 'text-on-surface',
      label: status,
    };

    return (
      <span
        className={`px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  return (
    <div className="w-full bg-surface-container border border-outline-variant rounded-2xl shadow-xl overflow-hidden flex flex-col">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-outline-variant bg-surface/80 text-secondary text-xs font-label-md uppercase tracking-wider font-bold">
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
          <tbody className="divide-y divide-outline-variant/60 text-sm text-on-surface">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-secondary font-medium">
                  No imported records match the current filter criteria.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((lead, idx) => {
                const phoneStr = lead.mobile_without_country_code
                  ? `${lead.country_code || '+91'} ${lead.mobile_without_country_code}`
                  : '—';
                const locationStr = [lead.city, lead.state].filter(Boolean).join(', ');

                return (
                  <tr
                    key={idx}
                    className="hover:bg-surface-dim/60 transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-semibold text-on-surface">
                      {lead.name || <span className="text-secondary italic">No Name</span>}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-on-surface/80">
                      {lead.email || <span className="text-secondary italic font-sans">—</span>}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-on-surface/80">
                      {phoneStr}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-on-surface">
                          {lead.company || '—'}
                        </span>
                        {locationStr && (
                          <span className="text-xs text-secondary">{locationStr}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(lead.crm_status)}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-xs text-secondary truncate" title={lead.crm_note}>
                      {lead.crm_note || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-mono bg-surface border border-outline-variant text-secondary uppercase">
                        {lead.data_source || 'Unknown'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={currentPage}
        totalItems={sortedRecords.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
};
