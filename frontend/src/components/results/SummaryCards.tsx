import React from 'react';
import { CheckCircle2, AlertTriangle, FileText, Clock } from 'lucide-react';

export interface SummaryCardsProps {
  totalReceived: number;
  totalImported: number;
  totalSkipped: number;
  processingTimeMs: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  totalReceived,
  totalImported,
  totalSkipped,
  processingTimeMs,
}) => {
  const formattedDuration =
    processingTimeMs < 1000
      ? `${processingTimeMs}ms`
      : `${(processingTimeMs / 1000).toFixed(2)}s`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {/* Total Received Card */}
      <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-between shadow-sm transition-all hover:border-outline">
        <div className="space-y-1">
          <span className="text-xs font-label-md text-secondary tracking-wide uppercase">
            Total Rows Received
          </span>
          <p className="text-2xl font-bold text-on-surface">
            {totalReceived.toLocaleString()}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <FileText className="w-6 h-6" />
        </div>
      </div>

      {/* Successfully Imported Card */}
      <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-between shadow-sm transition-all hover:border-emerald-500/50">
        <div className="space-y-1">
          <span className="text-xs font-label-md text-secondary tracking-wide uppercase">
            Successfully Imported
          </span>
          <p className="text-2xl font-bold text-emerald-400">
            {totalImported.toLocaleString()}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
      </div>

      {/* Skipped Records Card */}
      <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-between shadow-sm transition-all hover:border-amber-500/50">
        <div className="space-y-1">
          <span className="text-xs font-label-md text-secondary tracking-wide uppercase">
            Skipped Records
          </span>
          <p className="text-2xl font-bold text-amber-400">
            {totalSkipped.toLocaleString()}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
      </div>

      {/* Execution Time Card */}
      <div className="p-5 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-between shadow-sm transition-all hover:border-outline">
        <div className="space-y-1">
          <span className="text-xs font-label-md text-secondary tracking-wide uppercase">
            Processing Duration
          </span>
          <p className="text-2xl font-bold text-on-surface">
            {formattedDuration}
          </p>
        </div>
        <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
          <Clock className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
