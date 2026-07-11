'use client';

import React, { useRef, useState, useCallback } from 'react';
import { CsvDropzoneProps } from '../../types';
import { parseCsvFile } from '../../utils';

export const CsvDropzone: React.FC<CsvDropzoneProps> = ({
  onFileParsed,
  onError,
  onProcessingChange,
  isProcessing = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcessing = useCallback(
    async (file: File) => {
      if (isProcessing) return;

      if (onProcessingChange) {
        onProcessingChange(true);
      }

      try {
        const { rows, meta } = await parseCsvFile(file);
        onFileParsed(rows, meta);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'An unexpected error occurred during CSV parsing.';
        onError(errorMessage);
      } finally {
        if (onProcessingChange) {
          onProcessingChange(false);
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [isProcessing, onProcessingChange, onFileParsed, onError]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isProcessing) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileProcessing(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileProcessing(file);
    }
  };

  return (
    <div
      id="csv-dropzone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full max-w-2xl bg-surface-container-lowest rounded-xl border border-outline-variant p-xl text-center flex flex-col items-center transition-all duration-300 hover:shadow-lg relative ${
        isDragging ? 'scale-[1.01] border-primary bg-surface-container-low' : ''
      } ${isProcessing ? 'opacity-80 pointer-events-none' : ''}`}
    >
      {/* Processing Spinner Overlay */}
      {isProcessing && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 bg-surface-container-lowest/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center rounded-xl"
        >
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-sm" />
          <p className="font-headline-md text-body-lg font-bold text-primary">
            Parsing CSV file...
          </p>
          <p className="font-mono-sm text-secondary text-xs mt-1">
            Analyzing columns & validating boundaries in browser memory
          </p>
        </div>
      )}

      {/* Animated Background Decorative Element */}
      <div className="relative w-48 h-48 mb-lg flex items-center justify-center">
        <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse" />
        <div className="absolute inset-4 bg-primary/10 rounded-full animate-pulse delay-75" />
        <div className="z-10 bg-white shadow-xl rounded-2xl p-md border border-outline-variant/30 transform transition-transform hover:-translate-y-1">
          <span
            className="material-symbols-outlined text-[64px] text-primary"
            style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
          >
            upload_file
          </span>
        </div>
      </div>

      {/* Text Content */}
      <div className="space-y-sm mb-xl">
        <h3 className="font-headline-lg text-headline-lg text-on-surface">
          Upload your first CSV to begin
        </h3>
        <p className="font-body-lg text-body-lg text-secondary max-w-md mx-auto">
          Quickly map your local spreadsheet data to your CRM leads. Support for .csv, .xlsx, and .tsv formats.
        </p>
      </div>

      {/* Drag & Drop Area */}
      <div
        role="button"
        tabIndex={isProcessing ? -1 : 0}
        aria-label="Upload CSV file by dragging and dropping here, or pressing Enter or Space to browse local files"
        aria-busy={isProcessing}
        onKeyDown={(e) => {
          if (!isProcessing && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className="w-full upload-dashed-border bg-surface-container-low/30 py-xl px-lg mb-xl group cursor-pointer hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl transition-all duration-200"
      >
        <input
          ref={fileInputRef}
          id="file-input"
          type="file"
          accept=".csv,.tsv,.xlsx"
          className="hidden"
          onChange={handleFileChange}
          disabled={isProcessing}
        />
        <div className="cursor-pointer flex flex-col items-center">
          <span className="material-symbols-outlined text-primary mb-md transition-transform group-hover:scale-110">
            cloud_upload
          </span>
          <p className="font-label-md text-secondary">
            Drag and drop your file here, or{' '}
            <span className="text-primary font-bold">browse local files</span>
          </p>
          <p className="font-mono-sm text-secondary mt-base opacity-60">Maximum size: 15MB</p>
        </div>
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        disabled={isProcessing}
        onClick={() => fileInputRef.current?.click()}
        className="px-xl py-sm bg-primary text-on-primary rounded-lg font-label-md font-bold transition-all hover:opacity-90 hover:shadow-md active:scale-95 flex items-center gap-sm disabled:opacity-50 disabled:pointer-events-none"
      >
        <span className="material-symbols-outlined text-[20px]">file_open</span>
        Browse Files
      </button>

      {/* Helper Footer */}
      <div className="mt-xl pt-lg border-t border-outline-variant/30 w-full flex justify-between items-center">
        <div className="flex items-center gap-sm text-secondary">
          <span className="material-symbols-outlined text-sm">verified_user</span>
          <span className="font-label-md">Secure SSL encryption</span>
        </div>
        <div className="flex items-center gap-sm text-secondary">
          <span className="material-symbols-outlined text-sm">lightbulb</span>
          <a href="#" className="font-label-md hover:text-primary transition-colors">
            How to format CSV?
          </a>
        </div>
      </div>
    </div>
  );
};
