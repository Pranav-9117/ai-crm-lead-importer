import React from 'react';

export interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 py-4 px-6 bg-surface-container/50 border-t border-outline-variant rounded-b-2xl text-sm text-secondary">
      <div className="flex items-center gap-2">
        <span>Showing</span>
        <span className="font-semibold text-on-surface">
          {startItem} - {endItem}
        </span>
        <span>of</span>
        <span className="font-semibold text-on-surface">
          {totalItems.toLocaleString()}
        </span>
        <span>records</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="pageSize" className="text-xs font-medium">
            Per page:
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="px-2.5 py-1 bg-surface border border-outline-variant rounded-lg text-on-surface text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1 || totalItems === 0}
            className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface hover:bg-surface-dim disabled:opacity-40 disabled:pointer-events-none transition-colors font-medium text-xs"
          >
            Previous
          </button>
          <span className="px-2 text-xs font-semibold text-on-surface">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages || totalItems === 0}
            className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-on-surface hover:bg-surface-dim disabled:opacity-40 disabled:pointer-events-none transition-colors font-medium text-xs"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
