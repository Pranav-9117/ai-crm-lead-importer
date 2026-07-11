import React from 'react';
import Link from 'next/link';

export function SideNavBar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-[260px] bg-surface border-r border-outline-variant flex flex-col py-lg px-md z-40">
      {/* Brand Header */}
      <div className="mb-xl px-sm">
        <div className="flex items-center gap-sm">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center text-on-primary-container">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
              dataset
            </span>
          </div>
          <div>
            <h1 className="font-headline-lg text-headline-lg font-bold text-primary">GrowEasy</h1>
            <p className="font-label-md text-[10px] uppercase tracking-wider text-secondary opacity-70">
              AI CRM Importer
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-base">
        <button className="w-full mb-md flex items-center justify-center gap-sm bg-primary-container text-on-primary-container py-sm rounded-lg font-label-md transition-all hover:scale-[1.02] active:scale-95">
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Import
        </button>

        {/* Active Tab: Import CSV */}
        <Link
          href="/"
          className="flex items-center gap-md px-sm py-sm rounded-lg text-primary font-bold border-l-2 border-primary bg-primary-container/10 transition-colors duration-200"
        >
          <span className="material-symbols-outlined">upload_file</span>
          <span className="font-label-md">Import CSV</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-md px-sm py-sm rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors duration-200"
        >
          <span className="material-symbols-outlined">history</span>
          <span className="font-label-md">Import History</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-md px-sm py-sm rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors duration-200"
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="font-label-md">Settings</span>
        </Link>
      </nav>

      {/* Footer Nav */}
      <div className="mt-auto space-y-base pt-md border-t border-outline-variant/30">
        <Link
          href="/"
          className="flex items-center gap-md px-sm py-sm rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors duration-200"
        >
          <span className="material-symbols-outlined">help</span>
          <span className="font-label-md">Support</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-md px-sm py-sm rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-low transition-colors duration-200"
        >
          <span className="material-symbols-outlined">description</span>
          <span className="font-label-md">Documentation</span>
        </Link>
      </div>
    </aside>
  );
}
