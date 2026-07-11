'use client';

import React, { useRef, useState } from 'react';

interface UploadDropZoneProps {
  onFileSelect?: (file: File) => void;
}

export function UploadDropZone({ onFileSelect }: UploadDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (onFileSelect) {
        onFileSelect(file);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (onFileSelect) {
        onFileSelect(file);
      }
    }
  };

  return (
    <div
      id="drop-zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full max-w-2xl bg-surface-container-lowest rounded-xl border border-outline-variant p-xl text-center flex flex-col items-center transition-all duration-300 hover:shadow-lg ${
        isDragging ? 'scale-[1.01] border-primary bg-surface-container-low' : ''
      }`}
    >
      {/* Animated Background Decorative Element */}
      <div className="relative w-48 h-48 mb-lg flex items-center justify-center">
        <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse" />
        <div className="absolute inset-4 bg-primary/10 rounded-full animate-pulse delay-75" />
        <div className="z-10 bg-surface shadow-xl rounded-2xl p-md border border-outline-variant/30 transform transition-transform hover:-translate-y-1">
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
        onClick={() => fileInputRef.current?.click()}
        className="w-full upload-dashed-border bg-surface-container-low/30 py-xl px-lg mb-xl group cursor-pointer hover:bg-surface-container-low transition-colors duration-200"
      >
        <input
          ref={fileInputRef}
          id="file-input"
          type="file"
          accept=".csv,.tsv,.xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="cursor-pointer flex flex-col items-center">
          <span className="material-symbols-outlined text-primary mb-md transition-transform group-hover:scale-110">
            cloud_upload
          </span>
          <p className="font-label-md text-secondary">
            Drag and drop your file here, or{' '}
            <span className="text-primary font-bold">browse local files</span>
          </p>
          <p className="font-mono-sm text-secondary mt-base opacity-60">Maximum size: 50MB</p>
        </div>
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="px-xl py-sm bg-primary text-on-primary rounded-lg font-label-md font-bold transition-all hover:opacity-90 hover:shadow-md active:scale-95 flex items-center gap-sm"
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
}
