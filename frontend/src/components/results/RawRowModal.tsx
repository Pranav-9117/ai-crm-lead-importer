import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { CSVRow } from '../../types';

export interface RawRowModalProps {
  rowNumber: number;
  reason: string;
  rawRow: CSVRow;
  onClose: () => void;
}

export const RawRowModal: React.FC<RawRowModalProps> = ({
  rowNumber,
  reason,
  rawRow,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(rawRow, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-surface-container border border-outline-variant rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface">
          <div>
            <h3 className="text-lg font-bold text-on-surface">
              Skipped Row Details #{rowNumber}
            </h3>
            <p className="text-xs text-secondary mt-0.5 font-medium">
              Inspect original unparsed CSV payload
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-secondary hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Reason Badge / Alert */}
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col gap-1">
            <span className="text-xs font-label-md uppercase tracking-wider text-rose-400">
              Skip Reason
            </span>
            <p className="text-sm font-semibold text-rose-300">{reason}</p>
          </div>

          {/* Raw JSON Data Viewer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-label-md text-secondary uppercase tracking-wider">
                Raw Row Data (JSON)
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface border border-outline-variant text-xs font-medium text-on-surface hover:bg-surface-dim transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-surface-container border border-outline-variant text-xs font-mono text-on-surface overflow-x-auto max-h-[400px] leading-relaxed">
              <code>{jsonString}</code>
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-outline-variant flex justify-end bg-surface">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:bg-primary/90 transition-all shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
