import React, { useState } from 'react';
import { Eye, AlertTriangle } from 'lucide-react';
import { SkippedRecordDTO } from '../../types';
import { PaginationControls } from './PaginationControls';
import { RawRowModal } from './RawRowModal';

export interface SkippedRecordsTableProps {
  records: SkippedRecordDTO[];
}

export const SkippedRecordsTable: React.FC<SkippedRecordsTableProps> = ({ records }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedModalRow, setSelectedModalRow] = useState<SkippedRecordDTO | null>(null);

  const paginatedRecords = records.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="w-full bg-surface-container border border-outline-variant rounded-2xl shadow-xl overflow-hidden flex flex-col">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-outline-variant bg-surface/80 text-secondary text-xs font-label-md uppercase tracking-wider">
              <th className="py-3.5 px-6 w-24">Row #</th>
              <th className="py-3.5 px-6">Reason for Skip</th>
              <th className="py-3.5 px-6">Original Row Preview</th>
              <th className="py-3.5 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/60 text-sm text-on-surface">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-secondary font-medium">
                  No skipped records found.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((skip) => {
                const previewKeys = Object.keys(skip.raw_row || {}).slice(0, 3);
                const previewStr = previewKeys
                  .map((k) => `${k}: ${skip.raw_row[k] || 'null'}`)
                  .join(' | ');

                return (
                  <tr
                    key={skip.row_number}
                    className="hover:bg-surface-dim/60 transition-colors group"
                  >
                    <td className="py-4 px-6 font-mono font-bold text-amber-400">
                      #{skip.row_number}
                    </td>
                    <td className="py-4 px-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{skip.reason}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-secondary truncate max-w-md" title={JSON.stringify(skip.raw_row)}>
                      {previewStr || <span className="italic">Empty Row</span>}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedModalRow(skip)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-outline-variant hover:bg-surface-dim hover:border-outline text-xs font-medium text-on-surface transition-all shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5 text-primary" />
                        <span>View Raw Row</span>
                      </button>
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
        totalItems={records.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />

      {/* Raw Row Inspection Modal */}
      {selectedModalRow && (
        <RawRowModal
          rowNumber={selectedModalRow.row_number}
          reason={selectedModalRow.reason}
          rawRow={selectedModalRow.raw_row}
          onClose={() => setSelectedModalRow(null)}
        />
      )}
    </div>
  );
};
